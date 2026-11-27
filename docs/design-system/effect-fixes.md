# Effect fixes: before and after

This first implementation batch removes five effect sites: the two app theme effects, column-width mirroring, selected-operation lookup and manual indicator transition-listener setup. The inventory moves from **22 to 17**. Browser/network synchronization remains where it is needed.

The examples below are excerpts; the linked source files contain the complete implementations. The improvements are simpler ownership and verified behavior. No frame-rate or memory reduction is claimed without a measurement.

## 1. Theme selection becomes one user action

Before, selecting a theme updated React state; an effect later updated the document:

```jsx
useEffect(() => {
  document.documentElement.dataset.evenTheme = theme;
}, [theme]);
```

After, the selection handler performs both parts of the action:

```jsx
function chooseTheme(nextTheme) {
  document.documentElement.dataset.evenTheme = nextTheme;
  setTheme(nextTheme);
}
```

**Improvement:** the document update no longer waits for a separate effect. This does not eliminate a React render: state still changes once. The initial HTML already sets dark mode, and ConnectedApp reads the existing document theme. Storybook's externally supplied theme keeps its synchronization effect.

Sources: [ConnectedApp](../../frontend/src/pages/ConnectedApp/ConnectedApp.jsx), [staging host](../../frontend/src/staging.jsx). Existing tests verify light/dark selection without resetting tabs; browser checks cover sidebar placement and portal theme inheritance.

## 2. Column widths have one local owner

Before, React state and a ref both represented the width map:

```jsx
const [internal, setInternal] = useState(defaultWidths);
const latest = useRef(widths);

useLayoutEffect(() => {
  latest.current = widths;
});
```

The ref also accumulated rapid resize updates before React committed. Deleting it without replacing that behavior could lose updates to another column.

After, a small private store owns the uncontrolled width map. Each resize command updates that map immediately, publishes a new snapshot and returns the complete map for the caller callback. React reads it with its store-subscription hook:

```jsx
const [store] = useState(() => createWidthStore(defaultColumnWidths));
const internal = useSyncExternalStore(
  store.subscribe,
  store.getSnapshot,
  store.getSnapshot,
);
```

**Improvement:** the commit-time mirror is gone. Back-to-back resize commands use the latest width map and preserve other columns. Callbacks run from the action, not inside a React state updater that Strict Mode may replay. Each table owns its own store; controlled widths still come from the parent. The actual root-font measurement effect remains.

This subscription is an explicit state owner, not a timer or browser observer moved into another hook. React handles subscribing/unsubscribing; the store has no polling, global cache or scheduled work. It adds a small subscription abstraction to preserve the existing complete-map callback contract. See [React's store-subscription contract](https://react.dev/reference/react/useSyncExternalStore).

Source: [useColumnWidths](../../frontend/src/components/TraceTable/useColumnWidths.js). A new Strict Mode test batches changes to multiple columns, checks the final widths, verifies each complete callback map once, and verifies that a repeated no-op emits nothing. Existing tests cover controlled updates, resets, limits and independent tables.

## 3. React registers the selected Operation button

Before, the explorer searched markup after selection changed:

```jsx
useLayoutEffect(() => {
  operationRef.current = viewRef.current?.querySelector(
    '.even-trace-operation-action[aria-pressed="true"]',
  );
}, [active, selection?.traceId, filtered.length]);
```

After, TraceTable assigns the supplied ref to the selected button:

```jsx
<Button
  ref={selectedTraceId === trace.traceId ? selectedOperationRef : undefined}
>
  …
</Button>
```

The explorer supplies `selectedOperationRef={operationRef}` and still gives that ref to the inspector for focus restoration.

**Improvement:** no selector-based discovery effect. React registers the current DOM button and clears its ref when removed. Returning to an unmounted tab registers its replacement button. Inspector focus restoration is moved to an element-lifetime callback ref in the second batch below.

Sources: [TraceTable](../../frontend/src/components/TraceTable/TraceTable.jsx), [TraceExplorer](../../frontend/src/pages/HomePage/TraceExplorer.jsx). New behavior coverage checks selection, removal, restoration and unmount. The **Selected Operation Target** story demonstrates the public ref contract.

## 4. React owns indicator transition events

Before, an effect registered three native listeners and removed them during cleanup:

```jsx
indicator.addEventListener("transitionrun", moving);
indicator.addEventListener("transitionend", stopped);
indicator.addEventListener("transitioncancel", stopped);
```

After, the primitive receives declarative event handlers:

```jsx
<BaseTabs.Indicator
  onTransitionRun={moving}
  onTransitionEnd={stopped}
  onTransitionCancel={stopped}
/>
```

The handlers use `event.currentTarget` to find the indicator.

**Improvement:** one less setup effect and no manually maintained listener-removal code. Transition timing and browser event handling still exist. Existing browser checks verify intermediate indicator motion, hover/close behavior, scrolling, interruption and reduced motion.

Source: [StickyIndicator](../../frontend/src/components/WorkbenchTabs/StickyIndicator.jsx).

## 5. Rendered suggestions become state; idle callbacks use committed values

Search suggestions previously came from `metadata.current` during rendering. They now come from React state, updated with a new Map when a request completes. Existing metadata is retained for the same source and remains isolated across sources/agents.

**Improvement:** suggestion changes participate in React's updates rather than relying on another state change to reveal a ref mutation. Existing request tests cover completion metadata across queries and source changes.

The scroll-idle callback previously used a ref overwritten during rendering:

```jsx
const idleCallback = useRef(onScrollIdle);
idleCallback.current = onScrollIdle;
```

The first batch replaced that render-time mutation with an Effect Event:

```jsx
const notifyScrollIdle = useEffectEvent(() => onScrollIdle?.());
```

In that first batch, the existing effect's timeout called `notifyScrollIdle()` after scrolling stopped. The second batch below removes this effect and uses a stable callback with no changing render inputs.

**Improvement:** the timeout sees the latest committed callback without restarting viewport observation or publishing a callback from an abandoned render. The timer retains its real scroll-idle purpose and cleanup. This is the [documented Effect Event use](https://react.dev/reference/react/useEffectEvent), not a replacement for reactive dependencies.

## Lint now guards these patterns

The gate still checks hook ordering, dependencies, synchronous state resets and common resource cleanup. It now also enables React's `refs` rule and adds:

| Rule                             | What it catches                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `even/no-deferred-state-effects` | React-only state updates deferred through timers, animation frames, microtasks or an empty `Promise.resolve().then(...)`, including common local helper/setter aliases. |
| `even/no-ref-mirroring-effects`  | Effects whose only work is copying ordinary values into React refs.                                                                                                     |
| `react-hooks/refs`               | Known React refs read or written during rendering.                                                                                                                      |

For example, this previously escaped the synchronous-state rule even when its timeout was cleared:

```jsx
useEffect(() => {
  const timer = setTimeout(() => setVisible(items), 1);
  return () => clearTimeout(timer);
}, [items]);
```

It now fails the deferred-state rule. Cleanup does not make a delayed copy of existing state necessary. Derive the value during render or handle its user action directly.

Real timed UI state can have a reviewed `timedStateReason` in `lint/effects.json`. A necessary imperative integration can have a reviewed `refMirrorReason`. Those reasons do not override dependency, hook, cleanup or ref-purity rules. A new effect still requires an inventory entry explaining its external system and cleanup. These exceptions require an actual timing/integration purpose; they are not fixes for derived-state copies.

Tests include rejected tiny timers, intervals, frame callbacks, nested microtasks, aliases and the original same-site bypass. Positive cases include observer callbacks, debounced requests with cleanup, user event handlers and shadowed non-browser functions. A real asynchronous request is not classified as a React-only state deferral merely because it publishes loading state.

The checks use bounded local source analysis. They do not prove arbitrary imported helpers, custom-hook setters, async control flow or review reasons correct. Class lifecycles and external-store subscriptions still need resource review. No automatic rewrite is offered because choosing the right state/action owner requires understanding the behavior.

## Second batch: element lifetimes and one tab viewport owner

This batch takes **17 effect sites to 9**. Six focus/scroll effects move to callback refs; two overlapping tab viewport effects become one attachment-owned controller. These remain imperative browser operations. The improvement is matching their lifetime to the DOM they operate on, with explicit cleanup, rather than eliminating browser synchronization.

### Focus belongs to a committed element

Before, InspectorPanel needed an open-dependent effect to discover and focus its element, then restore focus on cleanup:

```jsx
useEffect(() => {
  const panel = ref.current;
  if (!open || !panel) return;
  const previous = returnFocusRef?.current ?? document.activeElement;
  if (autoFocus) panel.focus();
  return () => restoreIfPanelStillOwnsFocus(panel, previous);
}, [open, returnFocusRef, autoFocus]);
```

After, its ref callback receives the element directly and returns its focus cleanup:

```jsx
const attach = useCallback(
  (panel) => {
    if (!panel) return;
    const document = panel.ownerDocument;
    const previous = returnFocusRef?.current ?? document.activeElement;
    if (autoFocus) panel.focus();
    return () => {
      if (
        panel.contains(document.activeElement) ||
        document.activeElement === document.body
      )
        previous?.focus?.();
    };
  },
  [returnFocusRef, autoFocus],
);
```

React runs this callback during attachment and its cleanup during detachment or callback replacement. Stable callback identity means ordinary updates do not refocus the panel. Tests cover Strict Mode replay, return focus and leaving focus outside the inspector.

HomePage and the interactive tab stories similarly register committed tab elements. A pending focus request is set by the create/close action; registration fulfills it on the active tab with `preventScroll`. A private `RegisteredTab` keeps ref identity stable until registration inputs change. The viewport controller owns reveal geometry, so hosts no longer call `scrollIntoView` independently.

### Restore the actual scroll surface when it exists

Before, raw JSON restoration used an effect to search a wrapper for `<pre>` after selection/readiness changed:

```jsx
useLayoutEffect(() => {
  const content = ref.current?.querySelector("pre");
  const position = scrollPositions.current.get(key);
  if (content) {
    content.scrollTop = position?.top ?? 0;
    content.scrollLeft = position?.left ?? 0;
  }
}, [key, loading, error, scrollPositions]);
```

After, the raw panel forwards a ref to the actual code surface:

```jsx
const attachContent = useCallback(
  (content) => {
    if (!content) return;
    const position = scrollPositions.current.get(key);
    content.scrollTop = position?.top ?? 0;
    content.scrollLeft = position?.left ?? 0;
  },
  [key, scrollPositions],
);

<TraceRawPanel contentRef={attachContent} span={selected} />;
```

The code element attaches only when data is available. Its span key changes when selection changes. Restoring therefore works for delayed content without a wrapper query or loading-dependent effect. Scroll events record positions by scope/span, outside rendered state.

TraceExplorer uses separate refs for its vertical view and horizontal table region. TraceViewer.Path has a scope/readiness-aware callback and records which node/scope was restored. Loading/error placeholder scroll events cannot overwrite the saved content position. Ordinary selection changes keep the current reading position; entering/back navigation restores the saved position and fulfills pending tree focus only after a target exists. Refs hold positions and DOM ownership; they do not replace state used to render selection.

Tests cover both scroll axes, span changes, returning to a scope, delayed JSON, cleared refs, and ordinary updates that must preserve reading position.

### Tab observation has one attachment owner

Before, List created a ResizeObserver and scroll listener while `useStickyTab` separately created another ResizeObserver plus mutation, scroll, focus, wheel and touch subscriptions. List's setup depended on tab count.

After, a stable viewport callback creates one private controller:

```jsx
const attachViewport = useCallback(
  (viewport) => {
    if (!viewport) return;
    scrollRef.current = viewport;
    const owner = observeTabViewport(viewport, updateOverflow, updateHover);
    controller.current = owner;
    return () => {
      owner.dispose();
      if (controller.current === owner) {
        controller.current = null;
        scrollRef.current = null;
      }
    };
  },
  [updateOverflow, updateHover],
);
```

React event props deliver viewport events to that owner. It owns one resize observer, one mutation observer and the token-driven scroll-idle timer, releasing all three on detachment. It ignores already queued observer/timeout notifications after disposal. Current column/count geometry comes from committed markup, while hover is tracked by committed column rather than a captured array of tabs. This keeps the callbacks stable through hover and tab-list updates.

The two hook-owned viewport ResizeObservers become one. StickyIndicator's position subscription and TabMotion's snapshot/cancellation observation remain: those have different responsibilities and are not claimed as removed. No frame-rate or memory improvement has been measured. Native scrolling, sticky boundaries, hover suppression, motion timing and Base UI keyboard behavior retain their existing contracts.

## Remaining nine effects

| Work                                                                     | Sites | Why retained in this batch                                                             |
| ------------------------------------------------------------------------ | ----: | -------------------------------------------------------------------------------------- |
| Backend inventory, trace search and selected detail                      |     3 | Abortable requests track changing external resources.                                  |
| Conversation geometry, rail geometry, cell overflow and root-font widths |     4 | Browser layout/content/font measurement remains necessary; each owns observer cleanup. |
| Shared document input preference                                         |     1 | Document-level keyboard/pointer subscription outlives individual tab elements.         |
| Storybook document theme                                                 |     1 | Storybook supplies theme from outside the component.                                   |

The request-ID/state architecture, launch initialization and optional request deduplication remain separate follow-ups. Repeated table cell observation also remains open. The [baseline audit](effect-audit.md) describes the historical starting point. Lower effect count is not itself a performance result: callback refs, external-store subscriptions and class lifecycles require the same lifetime and cleanup review.
