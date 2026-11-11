# Even

Local backend adapter for a project's installed Eve. Requires Node.js 24 or later and Eve 1.0.0-rc.6 in the selected project's dependency tree.

## Launch

From this checkout, install dependencies once with `npm install`, then run:

```sh
npm start -- --project /absolute/path/to/eve-project
```

For an installed package, use `even --project /absolute/path/to/eve-project`. The project defaults to the current directory. `--port 0` selects a free port. Every launch prints one JSON line containing `url`, `token`, `project`, and `eveVersion`. Send `Authorization: Bearer <token>` on every request, including event streams.

Even binds to 127.0.0.1. Tokens are random per launch and held in memory. Cross-origin requests and unexpected Host headers are rejected. Treat the launch token as a local execution credential.

## API

All routes use the prefix `/api/v1`.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /agents | Eve discovery manifest and diagnostics for the selected application, including its subagents |
| GET | /sessions | Sessions created during this Even launch |
| POST | /sessions | Create an idle Eve session with `{}` for a single agent or `{"agentId":"support"}` for a workspace member |
| POST | /sessions/:sessionId/messages | Send `{"message":"hello"}`, returning an Eve delivery receipt |
| GET | /sessions/:sessionId/events | Live SSE carrying unchanged Eve event payloads and metadata |
| GET | /agents/:agentId/traces | Recorded local Eve traces |
| GET | /agents/:agentId/traces/:traceId | One recorded trace |

POST bodies require JSON and are limited to 64 KiB. Unknown fields are rejected. Message input currently supports text strings.

Event IDs are `line:index` positions from Eve's durable stream. Reconnect with `Last-Event-ID` or `?after=line:index`. Replay starts after that event, including any remaining events in the same line. Use `?follow=false` for a finite replay through the observed durable tail. If the upstream stream ends before that tail, Even emits an SSE error; reconnect with the last received event ID to resume. Trace nanosecond values are serialized as decimal strings.

## Execution and trust

Inventory uses Eve's non-importing discovery API. Reading inventory or recorded traces does not start the execution host, import authored agent modules, or compile artifacts. The first session creation starts Eve through its existing development-server launcher in a child process. Eve owns compilation, workers, workflows, source watching, and shutdown. Even requests localhost binding and a free port. Even reads the selected application's Eve server record and checks the recorded localhost server. A usable server is attached; otherwise Even starts one. Startup is serialized between Even processes by a temporary `.even-startup.lock` in the application directory. A stale server record falls back to startup.

**Attached servers retain their active configuration.** Even's host, port, and default-extension startup choices apply only to servers it starts. Attached servers can have different settings, including enabled development extensions. Closing Even leaves an attached server running. Closing Even stops a server it started, which also disconnects any other clients that subsequently attached to that server. Default development extensions are disabled for servers started by Even.

Even uses the same local client-options and linked-project credential helpers as Eve's TUI. Credentials are resolved through a callback for each request. Even does not claim interactive-terminal capabilities. The existing Eve channel decides access, including any stricter identity requirements. A disabled Eve channel remains unavailable.

For custom credentials, pass `--eve-headers /absolute/path/to/headers.json`. The file contains a JSON object of header names and string values, for example `{"Authorization":"Bearer …"}`. An explicit Authorization header takes precedence over automatic linked-project credentials. The file is read at launch; restart Even after changing static credentials. Keep it private. Even's incoming launch token is separate from these outgoing credentials.

Even's token protects its own API. Direct access to Eve's localhost listener follows the project's Eve channel authorization, including local-development access where configured. Even admits only session IDs created through its own launch. Recorded traces are read from the selected project's spool. Linked spool directories are followed, including destinations outside the project, consistent with Eve's filesystem behavior. Trace IDs remain validated; linked segment entries are skipped.

Authored code executes with the user's local privileges, as it does under Eve. Eve owns generated state and trace recording under the project's `.eve` directory. Even clears `EVE_DEV_STATE_DIR` for its launched host to use that project's default state path (which may be a symlink). Eve may create build caches or install optional runtime dependencies according to its normal behavior. Even imports installed Eve helpers without rewriting agent channels or Eve library code.

Select an Eve application, workspace root, or workspace member. A standalone application or selected member has API ID `root`. A selected workspace lists its members by Eve's member names. Subagents appear inside their root agent's discovery manifest and execute through Eve's delegation behavior. Discovery stays within the selected directory; unrelated projects are excluded.

For a workspace, supply `{"agentId":"support"}` when creating a session. Omitting agentId selects the only agent when the catalog contains exactly one. Session listings include agentId. Trace routes are nested under `/agents/:agentId/traces`. Session lists support `?agentId=support` filtering. Each inventory agent includes `runtime` with `state` (`disconnected`, `starting`, `ready`, or `unavailable`), `ownership` (`started`, `attached`, or null), and the Eve server URL when available. Runtime readiness is checked when inventory is requested, with a one-second timeout; it is a point-in-time observation. Inspecting inventory does not start a server. Each agent starts or attaches independently on its first session request. The adapter is version-gated because the discovery and hosting APIs are internal. Other Eve versions fail with an explicit compatibility error.

Browser UI, comparison view, Even-specific filesystem watcher features, and TUI session import are deferred. Eve's normal development watcher is active.

## Verification

```sh
npm test
EVEN_TEST_NODE_MODULES=/absolute/path/to/project/node_modules npm test
EVEN_TEST_NODE_MODULES=/absolute/path/to/project/node_modules node scripts/verify-pack.js
```

The integration fixture supplies a deterministic model through Eve's model interface. The tarball verifier runs `npm pack`, installs the tarball in a temporary directory, launches the installed `even` executable, and checks authentication, inventory, session creation, messaging, live events, replay, traces, and shutdown.

Trace inspection reuses one project-installed Eve `TraceStore` per selected agent. Eve owns parsed-segment caching and incremental reads; Even adds no second span cache or database. Trace inspection operations queue separately for each agent so concurrent requests cannot observe partially loaded segments. Lists and details retain full trace objects, including spans. Empty or malformed traces are omitted until a valid segment is available. Segment files follow Eve's immutable spool naming and read behavior.

Trace lists support `GET /api/v1/agents/:agentId/traces?sessionId=...`. This uses Eve's summary/query helpers to match recorded session identifiers (`agent.run.id`, falling back to `agent.session.id`), not conversation identifiers. A matching response contains the complete trace, including other sessions if they share that trace. Filtering does not import the recorded session into Even's live-session inventory.

TODO: Bound retained trace memory. Eve's current store retains parsed spans and assembled traces without a size limit or eviction API. For now, these caches live for the Even process lifetime; browsing a large history can increase memory usage. Revisit Eve eviction support or an explicit store-lifetime policy before adding another cache. Filtering still scans the agent's trace history; this is not a persistent index.

## API contract

[openapi.yaml](./openapi.yaml) is the HTTP contract for the backend and future UI. It documents requests, responses, bearer authentication, errors, and SSE framing/replay. Use the actual localhost port printed by the CLI. The file is included in the npm package; no documentation server is required.

Update the contract in the same change as API behavior. `npm run test:contract` validates the specification, checks route coverage, and checks representative HTTP inspection/error responses. The real-Eve integration test additionally validates session creation, delivery receipts, streamed event payloads, and trace responses against the contract. Run that suite with `EVEN_TEST_NODE_MODULES` as described above. Eve-owned discovery, event, and span fields remain extensible; these checks do not claim to validate every internal Eve field or every possible response.
