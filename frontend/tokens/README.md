# Token sources: options and decisions

These JSON files are the source of truth. We use the DTCG `$type`, `$value`, `$description`, and `{token.path}` reference conventions. There are only two layers: no component-token layer or public/private classification.

```text
tokens/options/*.json + tokens/decisions/*.json
                ↓
      style-dictionary.config.js
                ↓
       scripts/build-tokens.mjs
                ↓
 src/tokens/generated/tokens.css + token-manifest.json
                ↓
      Storybook and shared component styles
```

Style Dictionary loads and merges JSON, resolves aliases (failing on missing/circular references), transforms values, and formats CSS custom properties. The small build script orchestrates light/dark and sRGB/P3 outputs, formats deterministic artifacts and verifies freshness. It does not implement another alias resolver. The generated manifest supplies read-only data for documentation and tests; it is not another authored token source. Storybook is a consumer, not the compiler.

## Options

- `colors.light.json` / `colors.dark.json`: exact 8-bit sRGB fallbacks from the supplied **P3-first OKLCH palette v1.1.0 (V2)**. Eight families (blue, green, amber, red, teal, purple, pink, neutral) each have ten role-based steps; background has two separate canvases. DTCG color objects preserve channels and alpha. `options.onFill.<family>.7/8` stores each strong fill’s explicit text color.
- `colors.light.p3.json` / `colors.dark.p3.json`: original OKLCH overrides for all scales and canvases, bounded to Display P3. Style Dictionary includes the fallback source and applies these as higher-priority source values. CSS overrides are gated by P3 media capability and OKLCH support.
- `gray-alpha.light.json` / `gray-alpha.dark.json` and their `.p3.json` variants: ten translucent neutral equivalents derived from the existing neutral scale and page canvas. OKLCH C=0 endpoints provide P3-mode values, with equivalent sRGB fallbacks. These supplementary sources have their own derivation metadata and are not part of the imported V2 bundle.
- `fonts.json`: the self-hosted Geist Mono variable font stack (`options.font.mono`) and system sans-serif stack (`options.font.sans`). Its Fontsource package supplies local font assets; no runtime font CDN is used.
- `overlays.json`: Even’s supplementary translucent black scrim option (not part of the Geist grid).
- `shadows.json`: zero-chroma OKLCH black cast-shadow ink at 16% alpha, plus a soft shadow geometry using dimension options. The same black ink works in both themes; it is separate from theme-dependent gray-alpha overlays and the stronger modal scrim.
- `dimensions.json`: shared dimension scale for spacing and sizing: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128, 192, 256, 384, 512, 640, 768` px-equivalents at a 16px root.

The same file defines fixed-pixel `options.stroke.thin` (1px) and `options.stroke.strong` (2px), separate from the rem layout scale. These resolve through `size.border.control`, `size.focus.inset`, and `size.focus.outline`. The search field combines its persistent border with an inset shadow for focus; forced-colors mode uses the outline width and its negative offset. These decisions are shown in Storybook’s Sizing story, and stroke options in Options.

Dimension keys are stable labels for reference pixel equivalents; values use rem. For example:

```json
{
  "options": {
    "dimension": {
      "$type": "dimension",
      "16": { "$value": { "value": 1, "unit": "rem" } }
    }
  }
}
```

Do not force `html { font-size: 16px }` to make the equivalents literal. Rem units let spacing and control minimum sizes follow root text sizing. Browser zoom enlarges both px and rem; their distinction is their relationship to the root font size. Borders and focus strokes deliberately use fixed px options, independently of the rem layout scale. Responsive widths remain layout decisions; panel tokens are preferred sizes, not inflexible widths.

This curated scale follows the Refactoring UI reference supplied in the design discussion: fine increments at the small end and more separation at the large end. Carbon uses multiples of 2/4/8 and a similar spacing progression; Atlassian includes fractional steps around its 8px base. Our exact set is an Even decision, not a verbatim requirement from either system.

References:

- https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview
- https://atlassian.design/foundations/spacing/
- https://www.designtokens.org/tr/2025.10/format/
- https://styledictionary.com/info/architecture/

## Decisions

- `colors.json`: semantic aliases for surfaces, text, actions, selection/focus and status. Same names in both themes; values follow the theme's options. Control boundaries and outer focus rings use step 6. In-place focus boundaries use neutral step 9 through `border.focus`, independently of `focus.ring`. `selection.indicator` and `border.interaction` use blue step 6 for persistent selection marks and pointer-emphasized edges independently of `focus.ring`. `border.invalid` uses red step 9 independently of error text; neutral actions use fills 7/8 and their explicit on-fill foregrounds (including `action.hover-foreground`). Text uses 9/10. Strong-fill boundaries use `fill.border.<family>` (step 9), and filled actions use `action.border` for a persistent edge through hover. `neutral` replaces the former `gray` scale; the old Geist `gray-alpha` snapshot was removed; a new `gray-alpha` scale is derived from Even’s current neutrals as described below.
  `border.default` deliberately uses neutral step 3 for subtle layout and table-header dividers: lighter in light mode and darker in dark mode than the palette’s step-4 border. Meaningful control outlines continue to use `border.control` at step 6.
- `shadows.json`: `shadow.floating` aliases the soft shadow option for menus, selects, popovers, tooltips and dialog panels. The decision includes offset, blur, spread and ink. Use visual purpose, rather than z-index, to decide where it applies.
- `spacing.json`: relationships (`gap.tight`, `gap.related`, `gap.group`, `gap.section`) and insets (`tight`, `compact`, `default`, `spacious`). Gaps separate elements; insets provide internal padding. The small inset and tight gap both start at 4px-equivalent but can change independently.
- `typography.json`: `decision.font.data` selects the monospace stack for dense technical and tabular data. TraceTable, payloads and code consume the generated `--even-font-data`. `decision.font.ui` selects the system sans-serif stack for UI text, including Agent and Operation columns and their headers. Other typography properties remain provisional.
- `sizing.json`: icon dimensions, control minimum heights, preferred panel/navigation/field widths, control/panel corner radii, and shared border/focus widths. Flexible fields use `size.field.preferred`, independent of navigation sizing.

```json
{
  "decision": {
    "space": {
      "gap": {
        "related": {
          "$type": "dimension",
          "$value": "{options.dimension.8}"
        }
      }
    }
  }
}
```

This emits `--even-space-gap-related: var(--even-dimension-8)`. Both layers are available in CSS; prefer a decision when its meaning fits. Do not add aliases without a useful distinction. The icon default starts at 16px-equivalent; control minimum heights start at 32/40/48 for compact/default/comfortable. Allow controls to grow with content.

## Build and review

From `frontend`:

```sh
npm run tokens:derive-alpha # after changing neutral steps or the page canvas
npm run tokens:generate
npm run tokens:check
npm run tokens:watch # optional separate terminal during authoring
npm test
npm run build-storybook
npm run test:browser
```

`storybook`, `build-storybook`, and `test:watch` generate tokens first. `npm test` rejects stale outputs rather than silently repairing them. Commit the JSON sources and both deterministic generated outputs together. Editing generated CSS/manifest directly will fail the freshness check.

The configuration keeps our established color CSS names stable, names dimension options `--even-dimension-*`, and names spacing/sizing decisions `--even-space-*` / `--even-size-*`. Its custom color serializer is intentional: Style Dictionary's default `color/css` currently emits hex, losing wide-gamut source colors. The serializer uses Color.js to retain sRGB and OKLCH coordinates; the remaining build/reference/formatting machinery is Style Dictionary.

Open **Foundations / Colors** and **Foundations / Dimensions** in Storybook. The browser gate checks real resolved colors and contrast in both themes/gamuts, nested-theme aliases, absence of global leakage, and dimension scaling at 16px/20px root sizes. It also retains all component/overlay checks. The DOM tests cover option-to-decision propagation and broken/circular alias failures.

The stylesheet remains opt-in under `[data-even-theme="light"]` or `[data-even-theme="dark"]`. Apply the theme at the app's html root when building the app; portalled content must inherit or explicitly receive its theme. The pipeline only emits values. `src/components/components.css` consumes decisions to style controls and layouts. Storybook applies the active theme to HTML, including portalled content.

## Active color provenance and contracts

The accepted V2 palette was imported from the user-supplied `palette-bundle 2/palette.json` (bundle version 1.1.0) and adopted on 2026-11-16. Its SHA-256 is `b9ddb3e62cc061a6ed43d1d8640cc113e6129991579967456c922ae0ce65a9f6`. The source version, import/adoption dates, digest, and hue anchors are recorded in every color option file’s `com.even.provenance` extension. These are custom values inspired by Geist’s role structure rather than copied from Geist. The token JSON is the editable source of truth; the supplied CSS and preview are not runtime dependencies. The temporary V1/V2 comparison, duplicate snapshots, and preview build path were removed after adoption.

Eight fixed hue anchors are blue 255°, green 155°, amber 80°, red 25°, teal 190°, purple 305°, pink 350°, and achromatic neutral. Dark canvases are OKLCH L=0.22/0.26 with exact sRGB fallbacks #1b1b1b/#242424; light canvases are L=0.99/0.97 with #fcfcfc/#f5f5f5 fallbacks. CSS uses authored sRGB fallbacks by default and gates the original OKLCH source values behind P3 capability and OKLCH syntax support. The vivid fills retain their supplied values.

Steps 1–3 are subtle component backgrounds; 4–5 are decorative borders. Step 6 is the palette’s meaningful border/focus role; step 9 is readable text and step 10 strong text. Larger status regions and notices use their family’s 1/9/6 background/text/border decisions. Compact labels use `status.<tone>.compact-surface` (step 3) with the same step-9 text, following Geist’s guidance to use steps 2 or 3 for small elements such as badges. Unknown trace outcomes use the neutral `surface.active` (step 3) with secondary text. This separates surface emphasis by context without changing palette options. See https://vercel.com/geist/colors#colors-1-3-component-backgrounds. Strong fills 7/8 require their explicit `options.onFill` foregrounds; all chromatic V2 fills use black labels. Do not assume white labels or place text steps 9/10 on strong fills.

`decision.color.fill.border.<family>` selects the family’s existing step 9 to provide a visible edge for strong filled surfaces. `action.border` aliases the neutral boundary and persists through primary-button hover. Components consume these decisions rather than selecting palette options in CSS. This resolves component edges without darkening the accepted fills.

Tests recompute all 544 required palette pairings and 512 filled-boundary cases across both themes, both gamuts, default/hover fills, two canvases, same-family backgrounds 1–3, and neutral backgrounds 1–3. Boundary checks include a clipped-8-bit-sRGB cross-check, with a minimum ratio of 5.56:1. Raw fill/background contrast still falls below 3:1 in 138/320 combinations when the border is absent. Arbitrary cross-family, blended, translucent and image-background combinations are unvalidated.

The original P3 step-6 green and teal colors produce about 2.95:1/2.94:1 against same-family step-3 backgrounds under an 8-bit sRGB clipping calculation; their authored sRGB fallbacks and P3 luminance calculations pass. Filled surfaces use the stronger boundary decisions above. sRGB is WCAG’s defined contrast calculation; the P3 luminance extension and clipping checks are additional evidence rather than a physical-display certification. No color-vision simulation or user study is claimed.

**Foundations / Colors** documents the active palette and actual semantic pairings. **Workbench / WorkbenchLayout / Composed Explorer** shows the adopted component styling. Browser checks cover both themes, real CSS resolution in sRGB/P3, portal inheritance, primary-action boundaries, and placeholder contrast. Browser regressions also exercise ghost hover/pressed states, selected row foregrounds/status preservation, shared data fonts, and independent spacing, sizing and state decisions.

## Gray-alpha derivation and usage

`options.color.gray-alpha.1` through `.10` correspond to the existing opaque neutral steps. Use opaque neutral for ordinary text, icons, fills, dividers and borders. Use gray-alpha only when the background should show through, such as shadows or overlays. Components still consume a purpose-specific decision rather than a palette option. Do not replace opaque decisions globally.

The [OKLCH skill](https://github.com/jakubkrehel/oklch-skill) informs zero-chroma representation, alpha slash syntax, gamut checks and composited contrast review. Even keeps its existing ten role-based steps and independently authored light/dark neutrals. This adds translucency without redistributing the accepted palette.

Light ink is `oklch(0 0 0)`; dark ink is `oklch(1 0 0)`. For each step and gamut, convert the neutral target and `background.1` canvas into encoded sRGB, then solve source-over: `alpha = (target - canvas) / (ink - canvas)`. Alpha is rounded to six decimals. Do not interpolate OKLCH lightness to solve alpha: CSS compositing is a separate operation from choosing a perceptually uniform color space.

Each step reproduces its neutral target over the main canvas; over a different surface it intentionally blends to a different result. The split Storybook swatches demonstrate page versus blue-3 underlays. Dark white-alpha lightens overlays and is unsuitable for black cast shadows or modal dimming; `overlay.backdrop` retains its separate black 64% scrim. Floating panels use the separate black `shadow.floating` decision described below.

`npm run tokens:derive-alpha` explicitly updates the four derived JSON sources. `tokens:check` rejects stale derivations as well as stale CSS/manifest output. After neutral/canvas edits, rederive and regenerate, then commit sources and outputs together. Derivation metadata records the source, canvas, ink and method; the opaque palette’s original bundle provenance is untouched.

Tests cover chroma, bounded/increasing alpha, and mathematical reconstruction of every neutral in both gamuts/themes. Chromium also checks resolved alpha and paints each blend to verify it matches the neutral within one 8-bit channel level. Alpha colors have no standalone contrast guarantee: evaluate WCAG contrast and, when useful, APCA against the actual composite/background when assigning a new semantic use. These decorative swatches contain no foreground text, and opaque text/control decisions retain their existing WCAG checks.

### New gray-alpha values

These are additions; opaque neutral colors are unchanged. The sRGB and P3 columns differ slightly because their corresponding canvas/neutral sources differ. Each cell below specifies the complete equivalent OKLCH color, including alpha.

| Token               | Before | After (sRGB fallback equivalent / P3 source)          |
| ------------------- | ------ | ----------------------------------------------------- |
| light gray-alpha.1  | Absent | `oklch(0 0 0 / 0.019841)` / `oklch(0 0 0 / 0.019957)` |
| light gray-alpha.2  | Absent | `oklch(0 0 0 / 0.055556)` / `oklch(0 0 0 / 0.053048)` |
| light gray-alpha.3  | Absent | `oklch(0 0 0 / 0.095238)` / `oklch(0 0 0 / 0.09247)`  |
| light gray-alpha.4  | Absent | `oklch(0 0 0 / 0.18254)` / `oklch(0 0 0 / 0.183196)`  |
| light gray-alpha.5  | Absent | `oklch(0 0 0 / 0.297619)` / `oklch(0 0 0 / 0.297108)` |
| light gray-alpha.6  | Absent | `oklch(0 0 0 / 0.492063)` / `oklch(0 0 0 / 0.490011)` |
| light gray-alpha.7  | Absent | `oklch(0 0 0 / 0.551587)` / `oklch(0 0 0 / 0.549369)` |
| light gray-alpha.8  | Absent | `oklch(0 0 0 / 0.619048)` / `oklch(0 0 0 / 0.61745)`  |
| light gray-alpha.9  | Absent | `oklch(0 0 0 / 0.68254)` / `oklch(0 0 0 / 0.683474)`  |
| light gray-alpha.10 | Absent | `oklch(0 0 0 / 0.865079)` / `oklch(0 0 0 / 0.866745)` |
| dark gray-alpha.1   | Absent | `oklch(1 0 0 / 0.070175)` / `oklch(1 0 0 / 0.073166)` |
| dark gray-alpha.2   | Absent | `oklch(1 0 0 / 0.105263)` / `oklch(1 0 0 / 0.105975)` |
| dark gray-alpha.3   | Absent | `oklch(1 0 0 / 0.135965)` / `oklch(1 0 0 / 0.139564)` |
| dark gray-alpha.4   | Absent | `oklch(1 0 0 / 0.197368)` / `oklch(1 0 0 / 0.197141)` |
| dark gray-alpha.5   | Absent | `oklch(1 0 0 / 0.267544)` / `oklch(1 0 0 / 0.268638)` |
| dark gray-alpha.6   | Absent | `oklch(1 0 0 / 0.469298)` / `oklch(1 0 0 / 0.47036)`  |
| dark gray-alpha.7   | Absent | `oklch(1 0 0 / 0.52193)` / `oklch(1 0 0 / 0.523013)`  |
| dark gray-alpha.8   | Absent | `oklch(1 0 0 / 0.587719)` / `oklch(1 0 0 / 0.589956)` |
| dark gray-alpha.9   | Absent | `oklch(1 0 0 / 0.697368)` / `oklch(1 0 0 / 0.699516)` |
| dark gray-alpha.10  | Absent | `oklch(1 0 0 / 0.912281)` / `oklch(1 0 0 / 0.912368)` |

## Floating surface shadows

`decision.shadow.floating` supplies a shared soft cast shadow for floating menus, selects, popovers, tooltips and dialog panels. It resolves through `options.shadow.soft` to zero horizontal offset, 4px-equivalent vertical offset, 16px-equivalent blur and zero spread, with `options.shadow.ink` (`oklch(0 0 0 / 0.16)`). Dimensions follow root text sizing. Style Dictionary’s built-in `shadow/css/shorthand` transform compiles the DTCG shadow object and preserves its option references; no custom shadow compiler is needed.

The shared `.even-popup` presentation consumes `--even-shadow-floating`; caller classes, inline styles and decision overrides remain available. Stacking and dismissal behavior still belong to Base UI and the portal structure. A higher z-index does not automatically add a shadow, and ordinary panels, rows and page regions do not acquire one.

The gray-alpha scale continues to express background blending, including white-alpha lightening in dark mode. Cast shadows use black in both themes, while `overlay.backdrop` retains its separate black 64% dimming role. Borders continue to provide the panel edge; the decorative shadow is not an accessibility boundary or a text/background contrast target.

Review **Primitives / Popover / Initially Open**, **Primitives / Dialog / Initially Open**, and **Primitives / Dialog / Nested Overlays** in both themes.

| Before                            | After                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| No cast-shadow color option       | `options.shadow.ink`: `oklch(0 0 0 / 0.16)` in both themes                          |
| Floating panels had no box shadow | Shared `shadow.floating`: 0/4/16/0px-equivalent geometry with translucent black ink |
