# Even

Local browser workbench and backend adapter for a project's installed Eve. Requires Node.js 24 or later and Eve 1.0.0-rc.6 in the selected project's dependency tree.

## Launch

From this checkout, install and build once, then launch:

```sh
npm ci
npm --prefix frontend ci
npm run build:ui
npm start -- --project /absolute/path/to/eve-project
```

For an installed package, use `even --project /absolute/path/to/eve-project`. The project defaults to the current directory. `--port 0` selects a free port. Every launch prints one JSON line containing `url`, `browserUrl`, `token`, `project`, and `eveVersion`. The CLI opens `browserUrl` automatically. `--no-open` disables browser launch for headless use and automation. The installed package includes the built frontend. Programmatic API requests use `Authorization: Bearer <token>`; the browser authenticates automatically through its session cookie.

Even binds to 127.0.0.1. The launch link carries the initial credential in a URL fragment, which is never sent over HTTP and is removed before rendering. The app automatically exchanges it for a temporary HttpOnly, SameSite=Strict cookie, then discards the bearer credential. Refreshing or opening another tab in the same browser stays connected without entering a token. The cookie is scoped to the API path, named per bound port, and invalidated on every Even restart; a new CLI launch opens the new connection automatically.

Requests from foreign origins and unexpected Host headers are rejected. Browser cookies are accepted only with same-origin browser request metadata; public HTML never issues a credential. Programmatic bearer authentication remains available. Treat the printed launch token and browser link as local execution credentials. No token-entry form, account setup, password storage, localStorage, or sessionStorage is required.

## API

All API routes use the prefix `/api/v1`. The public `/` entry and `/assets/` serve only built frontend files, with no embedded launch credential. Static files and API requests use the same origin.

| Method | Route                            | Behavior                                                                                                  |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | /agents                          | Eve discovery manifest and diagnostics for the selected application, including its subagents              |
| GET    | /sessions                        | Sessions created during this Even launch                                                                  |
| POST   | /sessions                        | Create an idle Eve session with `{}` for a single agent or `{"agentId":"support"}` for a workspace member |
| POST   | /sessions/:sessionId/messages    | Send `{"message":"hello"}`, returning an Eve delivery receipt                                             |
| GET    | /sessions/:sessionId/events      | Live SSE carrying unchanged Eve event payloads and metadata                                               |
| GET    | /traces/search                   | Search recorded traces across the workspace; paginated summaries and matching excerpts                    |
| GET    | /agents/:agentId/traces          | Recorded local Eve traces                                                                                 |
| GET    | /agents/:agentId/traces/:traceId | One recorded trace                                                                                        |
| GET    | /agents/:agentId/reloads         | Reload occurrences observed during this Even launch                                                       |

POST bodies require JSON and are limited to 64 KiB. Unknown fields are rejected. Message input currently supports text strings.

Event IDs are `line:index` positions from Eve's durable stream. Reconnect with `Last-Event-ID` or `?after=line:index`. Replay starts after that event, including any remaining events in the same line. Use `?follow=false` for a finite replay through the observed durable tail. If the upstream stream ends before that tail, Even emits an SSE error; reconnect with the last received event ID to resume. Trace nanosecond values are serialized as decimal strings.

The first `GET /agents/:agentId/reloads` starts passive observation of that application's existing local Eve server. Even samples Eve's runtime token about once per second and returns `{observingSince, available, reloads}`. Each occurrence is `{id, type: "agent.reloaded", observedAt}`; records are oldest first. The first successful sample establishes a baseline, and an unavailable sample does not count as a reload. Observation also works for an Eve server started separately from Even. It never starts a host, imports authored code, requests a rebuild, or modifies Eve.

Reload markers mean Even observed a new runtime snapshot, not that a file was saved or a particular trace used a particular version. Several rebuilds between samples can appear as one occurrence. The history starts when requested, lives in memory for this Even launch, and is separate from Eve's durable session event stream. Revision tokens are only compared internally and are not returned or retained as version history. A UI can poll this endpoint alongside trace lists and merge markers by `observedAt`; no code snapshots, diffs, or trace-to-version associations are created.

## Agent spaces and workbench tabs

The connected app opens the first agent from the selected Eve project. Choose another agent in the left sidebar to restore its independent workbench. Each agent starts with a pinned **Traces** tab. Use **+** to open a **New trace explorer** or **New chat playground**; new tabs become active and receive focus.

Trace tabs retain their own query and recent searches, column widths, scroll position, loaded pages, selected trace/span, expanded spans, and inspector view. Switching agents or tabs restores that state without automatically refreshing. Use the `refresh-cw` icon button to request fresh results. Search and refresh reuse the existing trace APIs; opening or inspecting a tab does not execute an agent.

The `list-tree` icon identifies trace tabs; `message-square` identifies chat playgrounds. **Playground tabs are layout previews with a disabled composer.** They do not create a session, send a message, or subscribe to events. Live conversation integration is future work.

Use arrow keys, Home and End to navigate tabs. Delete closes a focused unpinned tab; its close button is also available by keyboard. Closing the active tab selects its right neighbor, otherwise its left; the pinned Traces tab cannot close. Closing a view discards its local state and does not delete trace files or cancel an Eve execution. Tabs and searches are in memory for this app instance and reset on a browser reload. URL sharing, saved views and tab reordering are not implemented.

The sun/moon selector at the bottom-left of the sidebar changes the page and portalled controls together. At narrow widths it appears below the agent navigation. The tab strip compresses within its width bounds, then scrolls; its active tab stays visible. Keyboard-driven changes are immediate, and reduced-motion preferences are honored. [Component contracts and Storybook previews](frontend/README.md#workbench-tabs) describe the detailed behavior.

## Using the search bar

The live browser opens from the `browserUrl` printed by Even. A separate simulated preview runs at http://127.0.0.1:5173/staging.html after `npm run dev:ui`. Click **Search traces...** for examples and field suggestions. Type to preview matching rows, use Up/Down and Enter to choose a suggestion, and Escape to dismiss the menu. Enter also remembers a valid query in the active trace tab’s recent searches. Each tab keeps its own recent queries until that tab closes or the app reloads. Remove a filter chip to remove its term, use the clear action to clear the query, or **Reset view** to clear that tab’s query. Reset view keeps the sidebar’s selected agent.

Use ordinary text when you do not need a field filter. Add `field:value` tags to narrow the question. Tags and plain text can be combined in one query:

| Query                                    | What it finds                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `deployment`                             | Literal text in trace labels, IDs, agent metadata or recorded content                   |
| `"deployment failure"`                   | That exact phrase, including the space                                                  |
| `tool:read_logs`                         | A trace containing the named tool                                                       |
| `tool:read_logs ECONNRESET`              | The named tool plus matching text; tool results/errors must come from the matching call |
| `tool:read_logs tool.status:error`       | A `read_logs` operation with a recorded error                                           |
| `tool:read_logs has:error`               | A trace that used `read_logs` and has an error anywhere, possibly in a different tool   |
| `output:"ECONNRESET"`                    | Text in an original tool result                                                         |
| `input:"deploy preview"`                 | Text in the original incoming message                                                   |
| `context:"deploy preview"`               | Text in model prompts, including copied conversation history                            |
| `reply:"retry later"`                    | Text in recorded model output                                                           |
| `error:"Permission denied"`              | Recorded status messages or exception messages/stacks                                   |
| `agent:research duration:>3s`            | Matching agent membership and more than three seconds of elapsed trace time             |
| `session:session-id`                     | An exact recorded session ID; a session can contain several traces                      |
| `trace:0123456789abcdef0123456789abcdef` | An exact trace ID                                                                       |

Agent names and tool/session/trace identifiers use exact, case-insensitive matching. `agent:` can match the workspace source ID or an agent name recorded inside a trace. The sidebar scopes the workspace source separately. Duration accepts `>`, `>=`, `<`, `<=` and `=` with `ms` or `s`, for example `duration:>=500ms`. Duration is elapsed trace time, not the sum of parallel tools’ durations.

Every term must match (**AND**). Plain words are separate terms: `deployment failure` can find the words in different recorded fields, while `"deployment failure"` requires the phrase in one field. Text matching is a case-insensitive literal substring search: `CONNRESET` can match `ECONNRESET`, and punctuation is literal. It does not interpret regular expressions, SQL, FTS syntax, OR operators or natural-language questions. Quote a phrase containing spaces or a literal colon, such as `"https://example.com"`; escape a quote inside a phrase as `\"`.

Bare text searches original incoming input, tool arguments/results, replies and errors, plus the trace’s label, ID and agent metadata. It excludes model prompt history unless you explicitly use `context:`. This prevents a tool result copied into later conversation context from silently becoming another original-output match. Serialized JSON payloads are decoded once and searched as their content values, not their property names; a phrase does not cross separate JSON values or messages. String values remain literal, including `null`, scientific notation, quoted text, and long numeric identifiers. When tool tags are present, tool status and tool-scoped payload terms must match one canonical operation, including when the same tool ran several times.

Incomplete quotes, missing values, unknown fields and invalid durations show a validation message. The current query limit is 2000 characters and 32 terms. Only `error` is supported by `has:` and `tool.status:`. Missing timing cannot satisfy a numeric duration filter. A recorded tool error does not imply that the agent ultimately failed, and an ended span does not establish completion of the whole trace.

Each matching row shows an excerpt and its source. Select the operation to open the best matching span in the inspector. **Why this trace matched** links to other matching spans. If content was not recorded, metadata can still match, but text search cannot recover absent prompts, outputs or error details.

The live browser uses actual Eve inventory and indexed search, scoped to its selected agent. Search is debounced, traces are always ordered newest first across the full result set before pagination, and **Load more traces** loads another page. The explorer has no sort controls; time-window filtering is planned as a separate control. Selecting a result fetches its full trace and opens the matching span; pruned traces and incomplete search coverage have explicit states.

Refresh is manual and keeps the current table, resized columns, focus and inspector while results update. An inspected execution remains open if it moves beyond the refreshed first page; detail failures stay inside the inspector.

Autocomplete uses inventory agent names and tool/agent metadata observed in loaded summaries, retained per source while queries change; it is not an exhaustive catalog of every tool. The simulated preview and Storybook remain labeled **staging data**. The shared query parser lives in `src/search/query.js` so the two use the same syntax.

## Backend trace search

`GET /api/v1/traces/search` searches all workspace sources by default. It requires the same per-launch bearer token as other routes. Set `EVEN_URL` and `EVEN_TOKEN` to the `url` and `token` printed by Even, then query:

```sh
curl --get "$EVEN_URL/api/v1/traces/search" \
  --header "Authorization: Bearer $EVEN_TOKEN" \
  --data-urlencode 'q=tool:read_logs tool.status:error' \
  --data-urlencode 'limit=50'
```

Optional parameters are `agentId` (exact catalog source), `sort` (`latest`, `duration`, `failures`, or `inputTokens`), `direction` (`ascending` or `descending`, default descending), `limit` (1–100, default 50), and `cursor`. Empty `q` lists summaries. Unknown or repeated parameters are rejected. A successful response contains:

- `results`: `{trace, matches, matchesTruncated}` entries. The trace is an Eve structural summary plus source `agentId`, label and content availability; full spans are loaded separately from the existing trace-detail route.
- `matches`: up to ten plain-text excerpts per trace, with the matching field, term and, when available, source span ID, canonical operation ID, attribute/event source and JSON path. A wrapper’s error can have a different source span ID from its execution operation. Render excerpts as text, never HTML.
- `total` and `nextCursor`: number of matching traces and an opaque continuation, or null at the end. Send the same query, source scope and sort with the cursor. A changed index or available source set returns HTTP 409; restart without a cursor. A malformed or unrelated cursor returns 400.
- `coverage`: discovered/indexed trace counts, unreadable segments, skipped traces, a check timestamp and up to twenty issues. `complete:false` means results cover only the readable, supported portion. `matchesTruncated` concerns displayed evidence, not the trace count.

`contentAvailability` is `captured` when some non-error content is present, `not-recorded` when content is absent and Eve recorded a disabled capture policy, otherwise `unknown`. It does not promise that every field was captured. Neither summaries nor search infer a successful completion flag from a lack of error spans.

### How the backend searches

Eve’s OTLP segment files remain the source of truth. A lazy worker uses the installed, version-checked Eve reader, summary and canonical-operation helpers to create a derived SQLite projection in `<selected-project>/.even/search-v1.sqlite`. Search does not start Eve, import authored agent modules, patch Eve or rewrite source trace files. A failed initialization, such as a temporary SQLite lock, returns an error for that request and is retried by the next search without restarting Even. The cache needs a writable `.even` directory; add `.even/` to the selected project’s gitignore. The database is created with owner-only file permissions and contains copies of searchable recorded content.

The projection contains summaries, metadata memberships, canonical tool-operation metadata and captured content values with their source locations. It does not store another complete span tree. Structured filters use normal database indexes. SQLite’s trigram text index narrows candidates for strings of at least three Unicode code points; a final literal substring check determines the match. Short strings use the same literal check without trigram acceleration. The search bar never passes user input directly to SQL or FTS operators. Parsing and database work run in the worker so the HTTP server can continue serving other requests.

Before each search, the worker reconciles the workspace spool. It compares segment filenames and file signatures, parses changed traces in bounded work, and transactionally replaces their projections. Unchanged traces reuse the persisted projection; changes to the extraction version automatically rebuild older projections on the next search. New spans can change operation pairing and totals, so the whole affected trace is recomputed through Eve’s helpers. Checkpoints are saved only with a successful transaction. Changed malformed segments cannot leave their old payloads searchable; valid portions remain available with incomplete coverage and unreadable segments are retried on later searches.

Source pruning and removed segments are reflected on the next search. A source that cannot be listed is excluded from that response and reported through coverage. This is request-driven reconciliation, not a background watcher or an archive beyond Eve retention. Each trace has an indexing limit of 64 MiB of source segments, 10,000 segments and 40 content nesting levels; traces beyond these limits are omitted with an issue instead of silently returning complete coverage. Eve’s reader also skips individual segment files larger than 8 MiB. Source discovery still scans filesystem metadata on each search, even when payload parsing is skipped.

The cache survives restarts. To rebuild it, stop Even and remove `.even/search-v1.sqlite` and any corresponding `-wal`/`-shm` files, then search again. SQLite rows and FTS entries are removed when traces are pruned; this is not a guarantee of forensic erasure from filesystems, backups or SQLite journals. Existing full-trace inspection remains separate and still uses Eve’s in-memory trace store.

## Execution and trust

Inventory uses Eve's non-importing discovery API. Reading inventory, recorded traces or search results does not start the execution host, import authored agent modules, or compile artifacts. The first session creation starts Eve through its existing development-server launcher in a child process. Eve owns compilation, workers, workflows, source watching, and shutdown. Even requests localhost binding and a free port. Even reads the selected application's Eve server record and checks the recorded localhost server. A usable server is attached; otherwise Even starts one. Startup is serialized between Even processes by a temporary `.even-startup.lock` in the application directory. A stale server record falls back to startup.

**Attached servers retain their active configuration.** Even's host, port, and default-extension startup choices apply only to servers it starts. Attached servers can have different settings, including enabled development extensions. Closing Even leaves an attached server running. Closing Even stops a server it started, which also disconnects any other clients that subsequently attached to that server. Default development extensions are disabled for servers started by Even.

Even uses the same local client-options and linked-project credential helpers as Eve's TUI. Credentials are resolved through a callback for each request. Even does not claim interactive-terminal capabilities. The existing Eve channel decides access, including any stricter identity requirements. A disabled Eve channel remains unavailable.

For custom credentials, pass `--eve-headers /absolute/path/to/headers.json`. The file contains a JSON object of header names and string values, for example `{"Authorization":"Bearer …"}`. An explicit Authorization header takes precedence over automatic linked-project credentials. The file is read at launch; restart Even after changing static credentials. Keep it private. Even's incoming launch token is separate from these outgoing credentials.

Even's token protects its own API. Direct access to Eve's localhost listener follows the project's Eve channel authorization, including local-development access where configured. Even admits only session IDs created through its own launch. Recorded traces are read from the selected project's spool. Linked spool directories are followed, including destinations outside the project, consistent with Eve's filesystem behavior. Trace IDs remain validated; linked segment entries are skipped.

Authored code executes with the user's local privileges, as it does under Eve. Eve owns generated state and trace recording under the project's `.eve` directory. Even clears `EVE_DEV_STATE_DIR` for its launched host to use that project's default state path (which may be a symlink). Eve may create build caches or install optional runtime dependencies according to its normal behavior. Even imports installed Eve helpers without rewriting agent channels or Eve library code.

Select an Eve application, workspace root, or workspace member. A standalone application or selected member has API ID `root`. A selected workspace lists its members by Eve's member names. Subagents appear inside their root agent's discovery manifest and execute through Eve's delegation behavior. Discovery stays within the selected directory; unrelated projects are excluded.

For a workspace, supply `{"agentId":"support"}` when creating a session. Omitting agentId selects the only agent when the catalog contains exactly one. Session listings include agentId. Trace routes are nested under `/agents/:agentId/traces`. Session lists support `?agentId=support` filtering. Each inventory agent includes `runtime` with `state` (`disconnected`, `starting`, `ready`, or `unavailable`), `ownership` (`started`, `attached`, or null), and the Eve server URL when available. Runtime readiness is checked when inventory is requested, with a one-second timeout; it is a point-in-time observation. Inspecting inventory does not start a server. Each agent starts or attaches independently on its first session request. The adapter is version-gated because the discovery and hosting APIs are internal. Other Eve versions fail with an explicit compatibility error.

The backend serves a real-data browser trace explorer; a separate staging preview is available for frontend review. Live playground wiring, comparison view, Even-specific filesystem watcher features, and TUI session import are deferred. Eve's normal development watcher is active.

## Verification

```sh
npm test
EVEN_TEST_NODE_MODULES=/absolute/path/to/project/node_modules npm test
EVEN_TEST_NODE_MODULES=/absolute/path/to/project/node_modules node scripts/verify-pack.js
```

The integration fixture supplies a deterministic model through Eve's model interface. The tarball verifier runs `npm pack`, installs the tarball in a temporary directory, launches the installed `even` executable, and checks authentication, inventory, session creation, messaging, live events, replay, traces, indexed search, and shutdown.

Trace inspection reuses one project-installed Eve `TraceStore` per selected agent. Eve owns parsed-segment caching and incremental reads; Even adds no second full-span cache; indexed search uses the separate derived SQLite projection described above. Trace inspection operations queue separately for each agent so concurrent requests cannot observe partially loaded segments. Lists and details retain full trace objects, including spans. Empty or malformed traces are omitted until a valid segment is available. Segment files follow Eve's immutable spool naming and read behavior.

Trace lists support `GET /api/v1/agents/:agentId/traces?sessionId=...`. This uses Eve's summary/query helpers to match recorded session identifiers (`agent.run.id`, falling back to `agent.session.id`), not conversation identifiers. A matching response contains the complete trace, including other sessions if they share that trace. Filtering does not import the recorded session into Even's live-session inventory.

TODO: Bound retained trace memory. Eve's current store retains parsed spans and assembled traces without a size limit or eviction API. For now, these caches live for the Even process lifetime; browsing a large history can increase memory usage. Revisit Eve eviction support or an explicit store-lifetime policy before adding another cache. The legacy full-trace/session filter still scans the agent's trace history. Use `/traces/search` for the persistent, paginated summary projection.

## API contract

[openapi.yaml](./openapi.yaml) is the HTTP contract for the backend and browser clients. It documents requests, responses, bearer authentication, errors, and SSE framing/replay. Use the actual localhost port printed by the CLI. The file is included in the npm package; no documentation server is required.

Update the contract in the same change as API behavior. `npm run test:contract` validates the specification, checks route coverage, and checks representative HTTP inspection/error responses. The real-Eve integration test additionally validates session creation, delivery receipts, streamed event payloads, and trace responses against the contract. Run that suite with `EVEN_TEST_NODE_MODULES` as described above. Eve-owned discovery, event, and span fields remain extensible; these checks do not claim to validate every internal Eve field or every possible response.

## Frontend component development

The token-styled React component library and Storybook live in [frontend](./frontend/README.md). Install its separate development dependencies with `npm --prefix frontend ci`, then run `npm run storybook`. Each component has colocated implementation, stories, and behavior tests. `npm run test:ui` runs component tests; `npm run test:all` runs backend and UI suites. The backend serves the built app from `frontend/dist`; `npm pack` rebuilds and includes those assets without adding frontend tooling to runtime dependencies. `npm run dev:ui` provides the connection page at `/` and the explicitly simulated preview at `/staging.html`. Use Even’s own browser link for real data. `EVEN_TEST_NODE_MODULES=/absolute/path/to/project/node_modules npm run test:app` builds and verifies the complete browser-to-Eve inspection flow in Chromium, including authentication, pagination and trace detail.

### Frontend foundations

Start with [frontend/AGENTS.md](frontend/AGENTS.md) for the development workflow, [frontend/README.md](frontend/README.md) for component contracts and ownership, and [the token guide](frontend/tokens/README.md) for options, decisions, and generation.

- **Tokens:** JSON in `frontend/tokens/options` and `frontend/tokens/decisions` is authoritative. Style Dictionary generates the committed CSS and manifest. Component styles consume semantic decisions; runtime measurements and derived tab geometry are layout state, not a third authored token layer.
- **Motion:** duration/easing decisions cover small transitions, 300–350ms large-area transitions, immediate interaction, and reduced-motion fades. CSS and Web Animations share the same generated values through `readMotionTiming`. The [motion contract](frontend/tokens/README.md#motion-decisions) explains which surfaces animate, input modality, interruption, and reduced motion.
- **Icons and theme:** Lucide icons are imported through semantic aliases in `frontend/src/components/icons.js`. Shared icon sizes and spacing use existing decisions. The Base UI-backed `ThemeToggle` supplies sun/moon radio options; the app owns the document theme. Icon-only controls retain accessible names.
- **Composition:** Base UI owns primitive selection, keyboard navigation, focus, dismissal, and overlay presence. Product composites own tab coordination; page controllers own data and per-view state. Reuse existing controls and keep public component implementation/story/test files together.

From `frontend`, run `npm run tokens:generate` after JSON edits, then `npm test`, `npm run build-storybook`, `npm run test:browser`, and `npm run format:check`. Commit generated token outputs with their JSON sources. **Foundations / Motion**, **Workbench / WorkbenchTabs**, **Primitives / ThemeToggle**, and **Pages / HomePage** provide the main review surfaces. Storybook displays generated tokens; it does not compile them.
