# Even component library

Base UI-backed controls and React product components for the v1 trace explorer, inspector, and secondary playground. Shared defaults use decision tokens and support light/dark themes. Components have no model calls or API integration. Each component has a colocated implementation, Storybook stories, and behavior tests.

## Run

From the repository root:

```sh
npm --prefix frontend ci
npm run storybook
npm run test:ui
npm run build-storybook
```

Storybook runs on port 6006. Use the **Dark / Light** toolbar to switch themes, including portal content. Open **Workbench / WorkbenchLayout / Composed Explorer** for an interactive fixture-backed explorer and playground. Its data and local sessions are demonstrations, not backend sessions. Component tests include every exported story rendered with accessibility checks, including portal content. For real Chromium rendering, accessibility audits, and integrated interaction checks:

```sh
cd frontend
npx playwright install chromium
npm run build-storybook
npm run test:browser
```

Chromium audits every story in both themes with color contrast enabled, including open overlay stories. DOM tests exclude contrast because jsdom does not provide real layout. They do not replace assistive-technology or usability testing. The backend's tests remain separate; `npm run test:all` at the root runs both suites. Set `EVEN_TEST_NODE_MODULES` at the root to enable real-Eve backend tests.

## Construction

`Name/Name.jsx`, `Name/Name.stories.jsx`, and `Name/Name.test.jsx` stay together. Shared interaction controls compose `@base-ui/react`; Base UI owns primitive state, context, keyboard navigation, focus, and dismissal. Even-specific cooperating parts may use their own context. Ordinary composites pass props. Native controls retain browser keyboard behavior. All components accept presentation through content and safe DOM props where applicable, with token-based defaults that callers can override.

## Presentation and overrides

`src/components/components.css` imports the generated tokens and defines defaults in the `even-components` cascade layer. Components load this shared stylesheet. Opt the host into a theme at its HTML root so portals inherit it:

```html
<html data-even-theme="dark">
```

Components select **decisions**, not palette steps or dimension options:

| Purpose | Decision tokens |
| --- | --- |
| Input surface, label, essential boundary | `surface.page`, `text.primary`, `border.control` |
| Solid primary action | `action.background`, `action.hover`, `action.foreground` |
| Keyboard focus and selected items | `focus.ring`, `selection.background`, `selection.foreground` |
| Related controls and panel padding | `space.gap.related`, `space.inset.default` |
| Compact/default control height | `size.control.compact`, `size.control.default` |
| Navigation and inspector widths | `size.navigation.preferred`, `size.panel.preferred` |
| Corners and modal dimming | `size.radius.control`, `size.radius.panel`, `overlay.backdrop` |

If a purpose is missing, add a useful decision in JSON and regenerate. Fixed 1px borders, focus outline widths, responsive breakpoints, and provisional system-font typography remain ordinary CSS; the typography foundation has not been designed yet. No new component-token layer is introduced.

```jsx
<Button variant="primary" size="compact" className="launch-action"
  style={{ minInlineSize: "10rem" }}>
  Run agent
</Button>
```

Ordinary, unlayered consumer CSS overrides library defaults; inline styles work too. Base UI parts also preserve `className={(state) => ...}`, `render`, refs, and event-details APIs. `TextField.className`/`style` target the input; `Select.className`/`style` target its trigger; overlay `Content` targets the popup. Use semantic tokens in overrides. For a nested theme, portal content still inherits its physical DOM host; apply the theme to the popup explicitly if it differs from the HTML theme.

The responsive workbench puts the inspector below the results when space is limited, stacks navigation on small screens, and contains table overflow in named keyboard-focusable regions. Base UI remains responsible for modal focus and overlay dismissal. Motion has not been added.

## Component contracts

| Component | Responsibility and state contract |
| --- | --- |
| WorkbenchLayout | Renders one named main landmark plus supplied navigation/inspector slots. Responsive CSS stacks the inspector/navigation when space is limited. No routing or application state. |
| Sidebar | Named navigation landmark; content supplied by caller. |
| InspectorPanel | Nonmodal aside with Header, Body, Close parts. Parent owns `open`/`onClose`; focuses on opening and restores focus when closing if focus was inside. Optional `returnFocusRef`. No focus trap. |
| Button | Base UI button, defaults to `type="button"`; `pending` exposes busy state and disables activation. `variant`: secondary (default), primary, ghost. `size`: default, compact, comfortable. |
| IconButton | Button with required `label` and decorative icon children. |
| TextField | Base UI Field/Input composition with associated `description` and `error`; normal input props including controlled value. |
| Select | Base UI select composition with `{value,label,disabled}` options and `onValueChange(value)`. The trigger is a button with combobox semantics; options live in a portal. Supports controlled/uncontrolled selection. |
| Tabs | Root requires a valid `defaultValue` or controlled `value`/`onValueChange`. List requires `label`; Trigger/Panel pairs use unique `value`. Base UI handles focus/selection. We opt into automatic activation; disabled tabs remain arrow-focusable for discoverability but cannot activate. Arrows and Home/End; horizontal and vertical orientation. Keep panels mounted. |
| Disclosure | One Trigger/Panel per root. `defaultOpen` or controlled `open`/`onOpenChange`. Base UI Collapsible owns state/semantics. Caller click handlers may cancel primitive handling with `event.preventBaseUIHandler()`. Root change callbacks receive Base UI event details; use `details.cancel()` to reject a transition. `aria-controls` is exposed while open. Panel remains mounted and hidden when collapsed. |
| Dialog | Base UI modal root with Trigger, Content, Title, Description, Close. Content assembles Portal/Backdrop/Viewport/Popup. Use title/description for accessible naming; Base UI handles focus containment, dismissal, and restoration. |
| Menu | Base UI action menu with Trigger, Content, Item, Group, GroupLabel, Separator. Content includes portal and positioner; keyboard navigation/typeahead and disabled items remain Base UI behavior. |
| Popover | Base UI interactive popup with Trigger, Content, Title, Description, Close. Content includes portal and positioner, with optional side/align. For anchored interactive content, not a general layout panel. |
| Tooltip | Base UI supplementary visual hint with Provider, Trigger, Content; focus/hover and Escape handling. Trigger must be independently named. Essential information belongs in visible text or Popover, not solely in a tooltip. |
| Separator | Base UI separator with horizontal/vertical orientation. |
| Notice | Ordinary status announcement; use `urgent` deliberately for an alert. Optional action. |
| ResultsState | `ready`, `loading`, `empty`, `no-matches`, `error`; optional retry. Loading may retain supplied stale children under busy state. Errors replace children. |
| CopyButton | Clipboard operation with pending, success, and failure feedback; value changes invalidate outdated results. |
| Timestamp | Valid date-like `value`; UTC by default with explicit timezone in displayed text; unknown values shown honestly. |
| Duration | Nonnegative finite milliseconds, including zero; missing/invalid values are unknown. |
| TraceStatus | Recorded errors take precedence; only explicit `complete` supports a completed outcome. Absence of errors alone does not mean success. |
| AgentSelector | Controlled agent selection from `{id,name?}` data; unknown IDs yield a prompt; empty inventory disables selection. |
| AgentNavigation | Agent-scoped encoded links for traces/playground; caller owns current route. |
| TraceToolbar | Controlled query and filter callbacks, refresh busy state, children for additional filter controls. No query parser, polling, or fetching. |
| FilterBar | `{id,label}` active filters; removal sends an ID; clear is a separate callback. |
| TraceTable | Semantic table of **summary view models**, explicit open buttons, controlled selection. Sort controls emit `{key,direction}`; caller sorts and filters data. Unknown values remain unknown. |
| TraceSummary | Trace-wide summary view model; does not filter totals by selected span or session. |
| SpanWaterfall | Root owns selection/expanded IDs unless controlled. Tree and Timeline share spans and selection through context. Tree arrows move focus, Right/Left expand/collapse, Enter/Space select. Expansion does not select. Missing-parent and cyclic spans stay visible. Timeline currently presents timing in a styled table. |
| SpanDetails | Supplied selected span or empty prompt; recorded status, duration, attributes, error detail. |
| AttributeList | Key/value semantics, local case-insensitive filter, exact serialized copy. Attributes should be JSON-compatible (bigint supported). |
| PayloadViewer | `undefined` means not captured; empty string means empty; malformed JSON remains plain text. Content is never inserted as HTML. Copy preserves original string. |
| SessionSelector | Controlled current-launch sessions and create callback; busy/error state. Does not imply historical session import. |
| Conversation | Message list with unique stable IDs; later entries with the same ID replace content in its original position. Preserves reading position when scrolled away and offers explicit follow. The message log has a bounded scroll container. Remount with a session key when changing sessions. No token-by-token announcements. |
| MessageComposer | Local draft, `onSend(text)` promise, parent `pending`/`disabled` support. Button submits; Enter inserts newline. Blocks duplicate requests; retains draft on failure and text edited during a pending send. Remount with session key to isolate drafts. |
| ViewExecutionAction | Explicit caller-provided trace mappings and `hrefForTrace(id)`; pending/missing/multiple mappings. Never guesses a prompt-to-trace relationship. |

## Data boundary

The current backend returns full traces with spans and nanosecond strings. `TraceTable` and `TraceSummary` intentionally consume a **summary view model**: `traceId`, optional `label`, `startedAt`, `durationMs`, `agentNames`, `spanCount`, `modelCalls`, `toolCalls`, `errorSpanCount`, and explicit `complete`. Do not pass raw API responses and assume these summaries exist. A later adapter should use verified Eve summary helpers or equivalent tested normalization. Local spans appearing on disk do not prove the whole trace completed.

Span components accept Eve-shaped `spanId`, `parentSpanId`, `name`, `startTimeNs`, `endTimeNs`, `attributes`, `statusCode`, `statusMessage`; nanosecond subtraction uses bigint before converting relative durations to milliseconds. Do not convert epoch nanoseconds to Number first.

Messages are `{id,role,content,executionAction?}` presentation data, not raw Eve events. Future integration must normalize events, handle replay/deduplication, and verify execution mappings. Traces can contain multiple sessions; session filtering must not silently strip the trace's other spans.

`test/fixtures.js` and `test/WorkbenchFixture.jsx` are demonstrative fixtures only. No business logic or network clients are hidden in generic components.

## Dependency notes

The isolated frontend package keeps Storybook/React tooling out of the backend's runtime dependencies and npm tarball. Lockfile overrides select patched `glob` and `minimatch` releases for Storybook's transitive documentation tooling; revisit when upstream updates its dependency ranges.

## Migration to Base UI

The custom Tabs and Disclosure state/context/keyboard implementations have been removed. Button and TextField use Base UI Button and Field/Input. Select now uses Base UI selection, focus, positioning, and dismissal instead of a native select wrapper. Product consumers keep their data/callback APIs.

Our `Tabs.Trigger` maps to Base UI `Tabs.Tab`; `Disclosure` maps to `Collapsible`. Tab/disclosure panels default to `keepMounted` for local child-state preservation. Root callbacks pass through Base UI event details. For primitive-specific props, consult the corresponding Base UI API rather than adding new behavior engines.

Notice, time/duration formatting, payload rendering and layout wrappers remain ordinary semantic React compositions because there is no equivalent Base UI primitive to replace. `InspectorPanel` remains a nonmodal inline product layout (not a modal Dialog). `SpanWaterfall` remains an Even-specific inspection widget; Base UI does not provide a trace tree/waterfall. Its custom context and navigation are intentionally confined to that product feature.

No shadcn source, theme, CSS framework, or decorative motion was added. Base UI’s intrinsic positioning/focus/visibility styles are behavioral. When building the actual app host, follow Base UI’s portal/root-isolation setup guidance: https://base-ui.com/react/overview/quick-start.

## Token foundations

See [color tokens](./src/tokens/README.md) and **Foundations / Colors** in Storybook for the Geist-based light/dark grid, semantic aliases, wide-gamut overrides, and contrast pairings. Shared component styles consume decision tokens; the host opts into a theme with `data-even-theme`. See [JSON options and decisions](./tokens/README.md) for the shared dimension scale, spacing/sizing decisions, and Style Dictionary pipeline. **Foundations / Dimensions** previews them. Run `npm run tokens:generate` after JSON changes; `npm test` checks both generated CSS and manifest freshness.

Style Dictionary currently carries a low-severity transitive `deepmerge` advisory in its build tooling. There is no nonbreaking upstream fix available at this writing; the suggested forced downgrade removes current DTCG support. Only repository-owned token JSON is compiled. Revisit the dependency when a compatible fix is published; do not downgrade the pipeline blindly.
