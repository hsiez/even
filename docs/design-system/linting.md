# Code quality gates

Run `npm ci` at the repository root and `npm --prefix frontend ci` for frontend development. Current lint tooling needs Node 24.15 or newer within the Node 24 line; the workflow uses current Node 24. Lint dependencies are development-only and are not included in Even's published runtime files.

```sh
npm run lint
npm run lint:audit
npm run test:lint
```

`lint` fails on any error or warning. It runs ESLint, Stylelint, and the effect-review inventory check. `test:all` runs lint before both unit suites. The [Quality GitHub workflow](../../.github/workflows/quality.yml) runs on every push and pull request. Its **Lint** job reports JavaScript/React, design-system, reviewed-effect and linter-regression checks as separate steps. **Tests and build** runs only after lint passes, covering both unit suites, token freshness, frontend formatting and the Storybook build. Both jobs install the root and frontend dependencies with lockfiles on Node 24, have time limits and use read-only repository permissions. New runs cancel superseded runs for the same ref. Browser interaction/contrast checks remain a separate `npm --prefix frontend run test:browser` gate after building Storybook. Merge protection is configured separately in GitHub repository rules; adding this workflow alone does not make its checks required for merging.

## Design rules

CSS and JavaScript inline styles share the policy in `lint/design-policy.mjs`. The generated manifest supplies the real decision and option names. The policy rejects literal colors, nonzero authored lengths for layout, explicit motion durations/easings, raw font families, direct foundation options and unknown Even custom-property references. It checks token fallbacks and literals inside `calc()` as well as standalone values. CSS syntax and duplicate-property checks run alongside the policy.

JavaScript coverage includes JSX style objects, local named/conditional/spread style objects, static DOM style assignments, `style.setProperty`, static `style.cssText`, and Web Animations keyframe/options objects. Numeric React layout styles count as authored pixels. Runtime measurements, data-dependent values and resolved timing objects are allowed. The checker does not evaluate arbitrary functions or imported style factories; those require review. It cannot determine whether a valid decision is semantically appropriate: borrowing a panel radius for a pill still needs human review and the rendered decision-usage checks.

The intentional boundaries are:

| Boundary                                                                                        | Reason                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token JSON and generated files                                                                  | Options are authored here; generated output is checked for freshness rather than linted as component source.                                                        |
| Foundations previews under `src/tokens`                                                         | The documentation must display and compare the raw options.                                                                                                         |
| `WorkbenchTabs.stories.jsx` sizing comparison                                                   | Existing, documented experimental decision overrides compare candidate tab profiles. Production defaults still come from JSON.                                      |
| Test files, test fixtures and browser-check scripts                                             | Adversarial overrides and captured payloads deliberately contain arbitrary values. Ordinary component stories are checked.                                          |
| Responsive media queries, percentages, viewport units and fractions                             | They express layout relationships rather than selecting a scale value. Nonzero fixed lengths in declarations still require decisions.                               |
| Font size, weight, line height, letter spacing and underline offset                             | These remain provisional per the existing typography contract. Add typography decisions before enforcing a new type scale. Font families already require decisions. |
| Mask ink                                                                                        | Black/white in a CSS mask represent alpha geometry, not a displayed palette color.                                                                                  |
| 1px screen-reader-only geometry and the trace-operation cell's definite-height sizing mechanism | These are browser/accessibility mechanisms, not visual design sizes. Exceptions are restricted to those existing selectors and properties.                          |

Internal CSS properties may derive from decisions and measured geometry. Runtime tab variables are explicitly listed, rather than permitting every unknown `--even-*` name. Adding a new visual purpose belongs in decision JSON followed by `npm --prefix frontend run tokens:generate`.

## JavaScript and effects

The [baseline effect audit](effect-audit.md) classifies the original 22 sites as internal bookkeeping, user actions, external synchronization or mixed responsibilities. The [implemented fixes](effect-fixes.md) include before-and-after code: five sites removed in the first batch, then eight focus/scroll and tab-viewport sites removed or consolidated in the second, leaving nine. Request synchronization remains valid; its state architecture still needs improvement. The registry checks growth/staleness, not architectural approval.

ESLint checks authored backend, frontend, configuration, scripts, stories and tests. It enforces basic JavaScript correctness and unused bindings. React rules enforce hook ordering, dependencies and the prohibition on synchronous state resets inside effects. Lifecycle rules check for leaked timeouts, intervals, event listeners, resize/intersection observers and fetches in React code. Inline ESLint and Stylelint disables cannot bypass the gate.

`react-hooks/refs` rejects known ref reads/writes during rendering. `even/no-ref-mirroring-effects` rejects effects that only copy ordinary values into refs. `even/no-deferred-state-effects` detects common React-only state updates deferred through timers, frames, microtasks and empty resolved-Promise callbacks, including local aliases/helpers. The original cleared-1ms-timeout bypass now fails even in an existing reviewed effect. Real debounced requests and observer callbacks remain supported. A timed UI state update needs `timedStateReason` in its site review; a necessary imperative mirror needs `refMirrorReason`. These reasons never override the other rules.

These are bounded source checks, not proofs about arbitrary helpers, custom hooks or async behavior. A genuinely asynchronous request is not treated as a state-only deferral. Inspect state ownership and the reason for timing during review, and do not add an exception merely to keep a derived-state reset.

An effect is for synchronization with an external system. Prefer calculations during render for derived values, event handlers for user actions, and keys for genuinely separate component lifetimes. An effect can be appropriate for an abortable request, a DOM subscription or layout measurement. DOM attachment work can use a callback ref with cleanup; scope-dependent restoration also needs explicit scope/readiness inputs and a guard against resetting ordinary updates. Replacing an effect with a ref does not remove its external-system obligations. A timer is not a substitute for React state modeling. Query debounce and scroll-idle detection have real timing requirements and retain explicit cancellation.

Every effect site is reviewed in `lint/effects.json`, grouped by file, owning function and hook. A new site fails lint until that entry describes its external system and resource lifetime. Aliased React imports and `React.useEffect` forms are included. The inventory check also rejects stale entries after effects are removed. This is an explicit review requirement, not an automatic quota increase: do not add an entry merely to silence lint. `useLayoutEffect` and `useInsertionEffect` receive the same scrutiny as `useEffect`.

Static analysis is not a memory-leak proof. A matching cleanup call may still target the wrong resource. MutationObserver, animation-frame scheduling, animation cancellation, class lifecycles, backend resource ownership and arbitrary async callbacks still need behavior tests and inspection. Timers/listeners/observers retain callbacks and their captured objects until released; React's effect mechanism does not itself disable garbage collection. Review cleanup on dependency changes and unmount, stale responses, interruption and Strict Mode replay.

The browser-session restart test creates a fresh HTTP connection after rebinding the same port. Its previous server has explicitly closed all connections, while Node's shared fetch pool can still retain one of those sockets briefly. A connection owned by the new server lifetime makes the old-cookie rejection assertion deterministic.

## Comment policy and audit

Authored JavaScript/JSX and CSS contain no explanatory code comments. Names and tests express behavior; durable reasons and exceptions live in documentation. The executable CLI shebang remains. Generated banners, dependencies, legal files, documentation code examples and comment-like text inside captured payloads are outside this rule. The former Vitest environment directive is now an explicit Node test project in `frontend/vite.config.js`.

`lint:audit` prints a JSON inventory of comment locations, effects, resource allocations and review signals. It flags suspicious identifiers and empty rejection handlers for inspection. These are leads, not proof of a workaround. Do not rename a questionable implementation or add an empty handler to satisfy a scanner; review the behavior and record the decision here.

## Initial review and repairs

The initial ESLint run found 258 authored JavaScript comment nodes, seven state-reset-effect diagnostics and nine dependency diagnostics. CSS comments were reviewed and removed too. The initial rollout also removed unused fixture imports and unused story state, rather than excluding stories/tests from JavaScript correctness checks.

| Finding                                                                | Resolution                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy feedback reset in an effect, including stale asynchronous results | Removed the effect. Feedback belongs to a value-specific request token. A guarded state adjustment preserves the same button DOM/focus; late results update only their original request. Clipboard promises cannot be canceled, and React ignores updates to unmounted components. |
| Explorer state-reset effects                                           | Removed all three. Loaded span defaults and ancestor expansion are derived until the user chooses them. Inactive-focus and disappeared-selection state adjustments are guarded in the owning component.                                                                            |
| Loading state published synchronously by request effects               | Derive loading from resource/request identity; only request results publish data. An Effect Event reads the prior resource snapshot without restarting the request on every response.                                                                                              |
| Zero-delay timer around immediate search/refresh                       | Removed. Immediate requests start directly; only new text queries use the actual 200ms debounce, canceled on replacement/unmount.                                                                                                                                                  |
| Detail identity omitted the data source                                | Include source identity, abort old work and discard stale delivery when replacing the source with the same agent/trace IDs.                                                                                                                                                        |
| Incomplete dependencies in viewer restoration and host tab focus       | Declare all dependencies. Restore path scroll only on an actual scope change, so selecting a row does not reset reading position.                                                                                                                                                  |
| Hard-coded control/separator strokes                                   | Use existing control/focus decisions; add `size.border.strong` for emphasized separator strokes independently of focus. Generated tokens accompany the source change.                                                                                                              |
| Generic font-family fallback in shared controls                        | Use the actual `font.ui` decision.                                                                                                                                                                                                                                                 |
| Parse-failure comments hiding empty catch blocks                       | Make plain-text fallback and unavailable reload revision explicit in the code.                                                                                                                                                                                                     |

These guarded state adjustments follow React's documented same-component conditional adjustment pattern. They do not enqueue timers or reset state after paint. See [React's guidance on deriving and resetting state](https://react.dev/learn/you-might-not-need-an-effect), [effect dependency linting](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps), and [state updates in effects](https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect).

### Reviewed complexity retained

- Workbench tab motion and scope navigation use outgoing decorative DOM snapshots. They exist to show removal/scope changes without delaying live state or duplicating interactive targets. The existing browser checks cover interruption, inertness, identifier stripping, focus, reduced motion, scroll and overflow. This is intentional presentation coordination, not a reason to add another selection engine.
- Empty rejection handlers for `Animation.finished` suppress expected cancellation of decoration. The settled-surface browser audit likewise permits canceled animations. They do not suppress request failures or navigation.
- Shutdown waits in `runtime-child.js` and `sessions.js` accept a rejected startup while still closing owned resources. Normal startup/request errors follow their existing reporting paths. Do not apply this pattern to general operations.
- The Eve reader serializes complete inspection operations per store because Eve can mark segments seen before asynchronous reads settle. That concurrency constraint remains intact.
- Authentication removes the launch fragment before rendering/session exchange; the static-file handler serves only the built entry and assets. Origin/Host validation precedes routing, an explicit invalid Authorization header cannot fall back to a cookie, and cookies are port-scoped. Removing explanations from source does not relax these contracts.
- Search keeps payload leaves separate, decodes only the captured boundary, and uses final literal matching after candidate indexing. It does not construct executable SQL/FTS from user syntax. Failed/unreadable source updates must not leave old content searchable.

### Follow-up requiring a separate behavior change

The former TODO in `src/traces.js` identified real outstanding work: Eve's assembled trace stores are retained for the reader lifetime, with no deliberate cache eviction policy. This rollout does not change Eve's cache ownership or pretend that removing the TODO bounds memory. Choose and test store lifetimes/eviction with Eve's reader contract before addressing it. The audit is preserved here so it is not lost when comments are removed.
