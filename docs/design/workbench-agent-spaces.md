# Agent spaces and workbench tabs proposal

Status: Proposed. The agent-space layout and tab behavior are agreed. Stack alignment takes priority before tab implementation: the current branch connects the browser and backend first.

Even opens an agent space from the sidebar. The main area contains tabs that users can open and close: trace explorers and chat playgrounds. Each agent starts with a pinned Traces tab, keeping inspection at the center of the experience while allowing several investigations and conversations to remain open.

Tab management belongs to the frontend. Eve remains responsible for execution and sessions; the backend supplies inventory, search, trace details, reload observations, and session events.

## Product behavior

### Agent selection

The sidebar lists agents in the selected workspace. Selecting an agent restores that agent's tabs, active tab, and view state. A newly visited agent starts on its pinned Traces tab. For the initial implementation, select the first inventory agent on launch; an empty inventory shows an empty workspace with no execution controls.

The current All agents table becomes an agent-scoped view. A workspace-wide overview can be added later as an explicit destination. Selecting another agent does not retarget existing tabs or move a conversation to a different agent.

### Opening and closing tabs

| Tab                       | Initial state                                               | Closing behavior                                                          |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Traces                    | One per agent, pinned, empty query and latest-first sorting | Cannot close                                                              |
| Additional trace explorer | Fresh query and newest-first order, scoped to its agent     | Discards that view's state; keeps trace files and the shared search index |
| Chat playground           | Empty draft, initially without an Eve session               | Discards the view; does not cancel execution or delete an Eve session     |

The plus button opens a menu with **New trace explorer** and **New chat playground**. New tabs append to the current agent's tab strip and become active. Use distinct initial labels such as Traces 2 and Playground 1; keep labels stable as the user edits a query. Renaming, duplication, dragging, and reopening closed tabs are later enhancements.

Closing the active tab selects its right neighbor, or its left neighbor when there is no tab to the right. Closing an inactive tab keeps the active tab unchanged. The pinned tab guarantees a remaining destination. After closure, keyboard focus moves to the replacement tab, or back to the unchanged active tab when closing an inactive one.

Tabs and their state live in memory for this browser app instance. Reloading the page returns to the initial layout. URL sharing and persistence across restarts are outside the first version.

### Independent investigations

Every trace explorer owns its query, column widths, scroll position, selected trace and span, expanded spans, and inspector detail view. Opening an inspector in one tab does not open it in another. Closing the inspector returns focus to the operation in that tab.

For example, Support can have the pinned Traces view, a second explorer with `tool:read_logs tool.status:error`, and a playground. Research has a separate set. Switching agents or tabs preserves each investigation.

The selected agent is a fixed source scope. An `agent:` search term continues to match recorded membership within that source; it does not silently change the sidebar selection. Retain the existing distinction between workspace source identity and agent names inside spans.

### Playground sessions and traces

Opening an empty playground is a local action and does not start Eve. On the first send, create one session for the tab's agent, bind its returned ID to the tab, then send the message. Later messages reuse that session. Block duplicate sends while session creation or delivery is pending. A failed creation retains the draft and allows an explicit retry; failed or ambiguous write requests must not be automatically retried as though they were reads.

A tab ID is a UI identity, a session ID identifies an Eve session, and a trace ID identifies recorded execution. They are separate values. A session can have multiple traces; a message delivery receipt does not establish completion or identify a trace by itself.

Initially, **View session traces** opens an additional explorer in the same agent space, prefilled with `session:<sessionId>`. Reuse that session's existing destination tab if it is still open. This shows all matching recorded traces for the session. A message-level **View execution** action is available only when verified event or trace data provides an explicit association; never guess from the newest trace or elapsed time.

Closing a playground does not promise to stop the agent. The current API has no session deletion or execution cancellation route. Sessions created during the current Even launch remain available through the existing session listing; tab closure does not reset their context. Reopening an existing session can be added separately from creating a fresh playground.

## Frontend design

### State and ownership

The page owns the selected agent and a workspace record for each agent, keyed by catalog source ID. Each record contains an ordered list of stable tab IDs, the active tab ID, and state for each tab. Tab records distinguish `traces` from `playground`; the default trace tab is marked pinned.

Keep view state above tab panels so it survives panel unmounts. A small reducer can own open, activate, close, and update actions; this does not replace Base UI's focus or keyboard behavior. The useful invariant is that an agent's active tab always exists and its pinned tab cannot be removed.

| Owner                 | State                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Workspace page        | Selected agent, each agent's tab order and active tab                                    |
| Trace tab record      | Query, widths, scroll, trace/span selection, expanded spans, inspector view              |
| Playground tab record | Draft, bound session ID, messages and reading position                                   |
| Data controller       | Pending requests, cached pages, event subscriptions, replay cursor and delivery progress |
| Existing primitives   | Keyboard navigation, primitive focus, popup state and dismissal                          |

Use `(agentId, traceId)` for trace identity and include the agent and tab IDs in request ownership. Trace IDs may occur under multiple workspace sources. Keep runtime handles such as AbortControllers and stream readers outside serializable view records.

Render the active panel and restore its state on activation. The existing Tabs panels default to `keepMounted`; explicitly choose unmounting for workbench panels once their state has been lifted. Hidden panels must not each run an independent polling loop. Refresh the active explorer and mark retained results stale when necessary; background explorers keep their last results until activated or explicitly refreshed.

Sending and receiving chat events belong to the data controller, so switching tabs or agents does not interrupt a delivery or lose messages. Keep one subscription per open session, rather than one per rendered panel. Closing its last view can release the subscription; it does not send a cancellation request. Settle pending requests safely after closure without recreating a closed tab.

### Component changes

| Component or composition   | Proposed change                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Workbench page             | Refactor the current HomePage composition to own agent spaces and tab records                                          |
| Sidebar                    | Reuse agent selection presentation; stop treating selection as one global table filter                                 |
| WorkbenchTabs              | Add a controlled product composition around the existing Base UI-backed Tabs, plus close controls and the new-tab Menu |
| Trace explorer view        | Extract the existing search, results and inspector composition, receiving state and callbacks for one tab              |
| Playground view            | Compose Conversation, MessageComposer, and session status; consume supplied session data and callbacks                 |
| WorkbenchLayout            | Reuse the structural shell; place the selected trace tab's inspector within that tab's work area                       |
| TraceSearch and TraceTable | Reuse their behavior; connect their controlled values to the owning tab                                                |

Keep one-screen compositions local to the page until an independent public component is useful. Every public component receives its own folder containing implementation, story, and behavior test. Follow the [component exemplar](../design-system/component-exemplar.md), [frontend workflow](../../frontend/AGENTS.md), and [existing contracts](../../frontend/README.md). Generic components receive data and callbacks; page controllers own API calls and product rules.

WorkbenchTabs should expose cooperating declarative parts where useful, with shared product coordination at the root. Base UI continues to own tab selection mechanics, roving focus, keyboard navigation, and menu dismissal. Use its supported composition APIs for close affordances; do not nest a close button inside a native tab button. Keep inspector Spans, Timing, and Summary tabs separate from the workbench tab strip, with distinct accessible labels.

### Accessibility and responsive behavior

Use an agent-specific accessible name for the workbench tab list. Preserve tab-to-panel relationships, keyboard selection, and visible focus. Close controls need specific names such as “Close Traces 2”; the pinned tab has no close control. New tabs receive focus, and close operations follow the focus rules above.

The tab strip scrolls horizontally when it runs out of room. Keep the new-tab action reachable and reveal the focused or active tab. At narrow widths, reuse the existing responsive sidebar arrangement; the selected agent and current tab must remain identifiable. An inspector stacks within its tab when the available width is too small.

### Design system decisions

Reuse the current options and decisions. Page and table surfaces use `surface.page`; control bands use `surface.secondary`; decorative separators use `border.default`. Interactive boundaries, focus, selection, text, gaps, insets, control heights and stroke widths use their existing purpose-specific decisions.

Do not introduce a palette change or a component-token layer for this feature. Add a semantic decision in JSON only when a new visual purpose cannot be expressed by the existing decisions, then regenerate CSS and the manifest. Keep styles in the shared component layer or scoped page layout as appropriate. The search field retains its neutral inset focus treatment; new tab controls retain the shared keyboard focus treatment.

## Backend design

### Existing APIs cover tab resources

Tab creation, closure, ordering, selection and query state require no backend endpoints or database tables. Opening another trace explorer shares the existing derived search index. Opening an empty playground makes no session request.

| Need                      | Existing API                                  | Integration rule                                                                     |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Agent spaces              | `GET /api/v1/agents`                          | Use catalog IDs and expose discovery diagnostics                                     |
| Trace explorer            | `GET /api/v1/traces/search`                   | Always supply the tab's `agentId`; keep query, cursor and results scoped to that tab |
| Inspector                 | `GET /api/v1/agents/:agentId/traces/:traceId` | Load full spans on selection; handle missing or pruned traces locally                |
| Reload dividers           | `GET /api/v1/agents/:agentId/reloads`         | Share observation data by agent; render markers for Started sorting only             |
| Create playground session | `POST /api/v1/sessions`                       | Supply the agent explicitly; starts or attaches to Eve as currently documented       |
| Send message              | `POST /api/v1/sessions/:sessionId/messages`   | Keep the returned receipt separate from execution completion                         |
| Session events            | `GET /api/v1/sessions/:sessionId/events`      | Use the browser session, retain replay cursor and deduplicate events                 |
| Current launch sessions   | `GET /api/v1/sessions?agentId=...`            | Does not import historical sessions from traces                                      |

These contracts are defined in [OpenAPI](../../openapi.yaml) and the [backend README](../../README.md). Eve continues to own context and execution. The search index remains derived data and does not become a registry of tabs, sessions, or agent revisions.

### Browser hosting and authentication

Stack alignment now provides the browser frontend and APIs from the same local Even server. The simulated preview remains separate for component development.

The CLI opens a browser link automatically. The app removes its credential fragment before rendering, exchanges it for a temporary HttpOnly session cookie, and discards the bearer credential. Refreshes and additional tabs stay connected automatically. Built HTML contains no credential and cannot establish a session without the initial authenticated exchange. Programmatic API clients retain bearer authentication; development previews do not receive broad cross-origin access.

The server admits the exact bound application origin and rejects foreign or null origins and alternate Host headers. Browser GET and POST behavior is covered by stack verification. Event streaming belongs to the subsequent playground integration.

Browser cookie authentication also allows same-origin EventSource connections. Choose and verify the event reader during playground integration, preserving `line:index` replay, reconnect deduplication and subscription cleanup. A replay cursor belongs to its session, not to whichever tab is active.

### Newest-first search and request lifecycle

Every explorer uses `sort=latest&direction=descending`, ordered by the backend before pagination. The page exposes no sort controls. The shared TraceTable still supports optional sorting for other compositions, and the backend retains its general sort/direction API. Future tab controllers must preserve the server order rather than sorting one loaded page independently.

Time-window controls are follow-up work: they will narrow the newest-first stream and belong to each explorer’s query state. They require backend filtering before pagination and participation in cursor identity; this change does not implement a time-window UI or API.

Each tab keeps its own search cursor and loaded pages. A changed query or source clears that tab's pagination. Refreshing the same query retains the mounted table, column widths, keyboard focus and inspector while loading or retrying. An execution absent from the new first page is not assumed deleted: keep its inspector and let trace-detail responses report actual unavailability. Autocomplete metadata comes from inventory and observed summaries, retained per source independently of matching rows. On the existing 409 stale-cursor response, restart that tab from its first page and identify the refresh. A 503 remains a retryable availability state; incomplete index coverage must remain visible within the affected view.

Abort obsolete read requests or ignore their results using a request identity. A late response for a closed tab or a previous query must not update another tab. Cached searches can be shared by resource key, but independent tab state must remain independent. Creating tabs does not create more search workers or index files.

### Session trace navigation

Session-level navigation already fits the search API through the `session:` filter and agent scope. No new trace-association endpoint is needed for that behavior. Completed delivery, an ended span, and whole-trace completion remain distinct observations.

Before shipping message-level execution links, verify Eve's available correlation fields using real multi-turn sessions, delegated work, and delayed trace export. If the current events and traces cannot establish the association, retain the session-level action and design a narrow backend extension separately. Never synthesize a one-message-to-one-trace guarantee.

## Delivery plan

| Phase                   | Frontend deliverable                                                                       | Backend deliverable                                                                | Completion condition                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 Stack alignment       | Connect inventory, search, details and reload observations; loading, errors and pagination | Same-origin browser hosting and credential flow; search direction; packaged assets | One local launch loads actual traces with authenticated browser access                                |
| 2 Agent spaces and tabs | Independent workspaces; pinned explorer; open/close explorers and fixture playgrounds      | Reuse the aligned stack                                                            | State isolation, closure and focus behavior work with real trace data and labeled playground fixtures |
| 3 Live playgrounds      | Session binding on first send; event-backed conversation; session-trace navigation         | Reuse current session APIs; verify event normalization and correlation             | Switching or closing views does not misroute messages or claim cancellation                           |

Keep stack alignment independently reviewable before adding workbench tabs. Playground fixtures remain clearly labeled until live integration is implemented. Update the frontend README when ownership and component contracts change; document API additions in OpenAPI alongside their implementation.

## Acceptance and verification

| Area             | Required checks                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent spaces     | Initial pinned tab; no-agent state; restore separate active tabs and investigations when switching agents                                                      |
| Tab lifecycle    | Both tab types; stable unique IDs and labels; cannot close pinned tab; active/inactive close selection and focus                                               |
| Trace isolation  | Different queries, widths, scroll and inspectors stay independent; identical trace IDs under different agents remain distinct                                  |
| Async behavior   | Out-of-order responses, changed queries, closed tabs, errors, incomplete coverage, pagination invalidation, and reactivation refresh                           |
| Playground       | First send creates one session; later sends reuse it; failed creation retains draft; background events continue; close does not cancel execution               |
| Trace navigation | Session filter opens or reuses the correct agent's explorer; delayed or absent traces remain honest; explicit multi-trace mappings are supported when verified |
| Accessibility    | Tab/panel relationships, names, keyboard traversal, close focus, menu dismissal, nested inspector tabs and narrow-width overflow                               |
| Backend          | Agent scoping, global sort directions, cursor identity, authenticated same-origin browser writes, rejected foreign origins, SSE replay and passive inspection  |

Add behavior tests and interactive colocated stories for each new public component, then cover the composed page in both themes and narrow layouts. Run frontend tests, Storybook build and browser checks for implementation changes. For live integration, also run backend contract tests, real-Eve integration and installed-package verification. Manual screen-reader review remains part of accessibility validation.
