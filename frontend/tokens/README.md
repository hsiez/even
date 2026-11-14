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

- `colors.light.json` / `colors.dark.json`: Geist palette snapshot with source/retrieval metadata. Background has two steps; each other family has ten. DTCG color objects preserve color space, coordinates and alpha.
- `colors.light.p3.json` / `colors.dark.p3.json`: chromatic overrides. Style Dictionary includes the fallback source and applies these as higher-priority source values. CSS overrides are gated by P3 media capability and OKLCH support.
- `overlays.json`: Even’s supplementary translucent black scrim option (not part of the Geist grid).
- `dimensions.json`: shared dimension scale for spacing and sizing: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128, 192, 256, 384, 512, 640, 768` px-equivalents at a 16px root.

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

Do not force `html { font-size: 16px }` to make the equivalents literal. Rem units let spacing and control minimum sizes follow root text sizing. Browser zoom enlarges both px and rem; their distinction is their relationship to the root font size. Borders and intentionally fixed details may use px when later introduced. Responsive widths remain layout decisions; panel tokens are preferred sizes, not inflexible widths.

This curated scale follows the Refactoring UI reference supplied in the design discussion: fine increments at the small end and more separation at the large end. Carbon uses multiples of 2/4/8 and a similar spacing progression; Atlassian includes fractional steps around its 8px base. Our exact set is an Even decision, not a verbatim requirement from either system.

References:

- https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview
- https://atlassian.design/foundations/spacing/
- https://www.designtokens.org/tr/2025.10/format/
- https://styledictionary.com/info/architecture/

## Decisions

- `colors.json`: semantic aliases for surfaces, text, actions, selection/focus and status. Same names in both themes; values follow the theme's options.
- `spacing.json`: relationships (`gap.tight`, `gap.related`, `gap.group`, `gap.section`) and insets (`compact`, `default`, `spacious`).
- `sizing.json`: icon dimensions, control minimum heights, and preferred panel/navigation widths, and control/panel corner radii.

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
