# useEffect audit: calculations, actions and synchronization

This baseline review classifies the 22 effect sites present before the first fix batch by **why their work needs to run**. It includes `useLayoutEffect`. The [implemented before-and-after fixes](effect-fixes.md) remove five sites in the first batch and eight in the second; the current inventory has **9**. The findings below describe that original baseline.

| Reason                                                       | Correct home                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Calculate an answer from current props/state                 | Calculate it during rendering. No effect.                            |
| Perform a particular user action                             | Use that action's event handler.                                     |
| Keep a browser or network system aligned with the current UI | An effect may be appropriate, with the correct lifetime and cleanup. |

A user click can lead to all three. Clicking an agent changes selection in a handler; rendering calculates its label; a request keeps its displayed data current. Classify the actual work, not the interaction that happened earlier.

## 1. Calculations and internal bookkeeping

**Finding:** No remaining effect only filters, sorts or formats props into another state value. Trace filtering, sorting, selected-span lookup and token totals already use ordinary calculations or memoized calculations.

One effect still performs internal bookkeeping: `useColumnWidths` copies the normalized width map into `latest.current` after every commit.

**Risk:** The state and ref represent the same widths, requiring coordination during controlled updates and rapid resizing. There is no browser system in that particular effect.

**Fix:** Keep normalized widths calculated during rendering. Give resize actions one canonical width owner, preserving controlled callbacks and batched updates, then remove the mirror effect. Writing that ref during rendering would simply introduce a different problem.

Response normalization can remain a pure helper called when data arrives. This rule does not mean moving every calculation in the application into a component; it means avoiding extra state for an answer already available from existing React inputs.

## 2. User actions

**Finding:** The two app theme effects in `ConnectedApp` and `StagingApp` can move into the theme-selection action. These hosts own the selection, and their initial HTML already supplies the dark theme.

Current sequence:

```jsx
useEffect(() => {
  document.documentElement.dataset.evenTheme = theme;
}, [theme]);
```

Proposed handler:

```jsx
function chooseTheme(nextTheme) {
  document.documentElement.dataset.evenTheme = nextTheme;
  setTheme(nextTheme);
}
```

**Risk:** The current implementation makes the document wait for an effect after the state change. This is an unnecessary synchronization step, not evidence of a leak or another state-triggered render.

**Fix:** Route all app-owned choices through the handler and preserve initialization. Storybook is different: its theme arrives from an external host, so its document-sync effect remains justified.

Refresh, retry and load-more are also user commands. They currently share request machinery with automatic loading. A refresh counter is an indirection, not automatically a React violation. Explicit commands can make ownership clearer; changing that API alone does not prove a performance improvement.

## 3. External synchronization

**Correction to the earlier audit:** The three request effects have legitimate external work. Their complexity does not establish that their effects should disappear.

| Site                     | Why the work runs                                 | Decision                                                                              |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ConnectedApp` inventory | Keep the workspace aligned with its API client    | Retain request synchronization; separate launch initialization and retry.             |
| `useTraceData`           | Keep results aligned with source, agent and query | Retain synchronization; clarify request state and explicit refresh/load-more actions. |
| `useTraceDetail`         | Keep details aligned with the selected trace      | Retain synchronization; preserve cancellation and stale-response protection.          |

**Risk:** Request identity, loading and cached metadata currently have several representations. Prior probes reproduced duplicate searches and repeated initializer calls during Strict Mode replay. Result guards do not prevent initialization from starting twice. Memoized object identity is also being used as request identity, although memoization is only an optimization.

**Fix:** Use explicit request IDs and one owner for request state; make launch initialization safe to repeat; cancel superseded work; reject stale results. Store displayed suggestions in state or a subscribed store rather than reading mutable refs during rendering. Sharing identical requests is an optional efficiency improvement. A new cache library or a wholesale removal of fetching effects is not required by this audit.

### Browser effects: justified purpose versus implementation issues

An observer watches an element and calls our code when its size/content changes. Registering it starts that watch; cleanup stops it.

- **`CellOverflow`: keep measurement, improve its lifetime.** Its `children` dependency makes unrelated renders reconnect observers. Previously, row selection added eight registrations while the active count stayed at 14. This is redundant setup, not a demonstrated leak. Share observation or separate persistent setup from content remeasurement. Do not delete dependencies blindly: changed text can need remeasurement even when its overall size stays the same.
- **Tab viewport: keep synchronization, consolidate duplicate work.** The previous probe found four authored scroll listeners and four ResizeObserver owners. Share viewport measurements where consumers overlap, while preserving Base UI's selection behavior. A scroll-idle timer serves a real timing requirement and needs cleanup.
- **Opener lookup: simplify DOM ownership.** `TraceExplorer` queries markup to find its selected Operation button. Capture/register the opener instead, including replacement buttons after a tab is restored. This is browser bookkeeping, not a data transformation.
- **Transition listeners: prefer React event props.** `StickyIndicator` can replace its manual listener effect with declarative transition handlers. Its purpose is still external event handling; this is an implementation simplification.
- **Focus and scroll restoration: retain the post-render work.** A new tab or scope must exist in the browser before we can focus or scroll it. Moving that work directly into the click handler could target an old or missing element.

## Coverage of all 22 sites

| Purpose                                          | Sites | Classification                                                                    |
| ------------------------------------------------ | ----: | --------------------------------------------------------------------------------- |
| Column-width mirror                              |     1 | Internal bookkeeping; remove after fixing state ownership.                        |
| App theme selection                              |     2 | User-action driven; move to handlers.                                             |
| Inventory, search and detail loading             |     3 | Mixed user commands and valid network synchronization; separate responsibilities. |
| Inspector, home-page and story tab focus         |     3 | Browser synchronization after rendering.                                          |
| Viewer path/JSON and explorer scroll restoration |     3 | Browser synchronization after rendering.                                          |
| Selected Operation button lookup                 |     1 | Browser bookkeeping; use trigger registration.                                    |
| Trace rail, cell clipping and root-font sizing   |     3 | Browser measurement; keep, improve observation where needed.                      |
| Conversation following                           |     1 | Browser content/size synchronization.                                             |
| Motion input preference                          |     1 | Document event subscription.                                                      |
| Sticky-tab coordination                          |     1 | Browser scroll/geometry synchronization.                                          |
| Tab-list observation                             |     1 | Browser synchronization with duplicated setup to consolidate.                     |
| Indicator transition listeners                   |     1 | Browser events; React can own registration.                                       |
| Storybook theme                                  |     1 | Externally supplied theme synchronized with the document.                         |

## What to fix first

1. Remove internal width mirroring and app theme indirection.
2. Separate request synchronization, startup and user commands; correct request-state ownership.
3. Reduce repeated observer setup and overlapping viewport measurements.
4. Test cleanup, stale responses, rapid actions and focus restoration.

The effect inventory blocks unreviewed growth; it does not prove necessity or correctness. Counting fewer hooks is not the goal. The goal is calculations during rendering, actions in handlers, and narrowly scoped synchronization with external systems.

React references: [derive data during rendering](https://react.dev/learn/you-might-not-need-an-effect), [events versus effects](https://react.dev/learn/separating-events-from-effects), and [effect setup and cleanup](https://react.dev/learn/synchronizing-with-effects).
