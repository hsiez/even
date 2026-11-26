# Token consumers and generated outputs

The source of truth is now [`frontend/tokens`](../../tokens/README.md): JSON options and decisions for colors, spacing, sizing, motion and the technical-data font family. Read that guide for the scale, provenance, naming and Style Dictionary build process.

- `generated/tokens.css`: generated opt-in CSS custom properties. Do not edit by hand.
- `generated/token-manifest.json`: generated resolved values, alias relationships, descriptions and CSS names for documentation/tests. Do not edit by hand.
- `colors.js` / `dimensions.js` / `motion.js`: read-only views of the generated manifest, plus color role/contrast test definitions. Motion also reads resolved CSS decisions for WAAPI, including caller overrides. No authored token values or decision aliases live in JavaScript.
- `ColorGrid/` / `DimensionGrid/` / `MotionGrid/`: Storybook documentation, including isolated presentation CSS; the component library consumes decision tokens in `../components/components.css`.

## Color contract

The supplied **P3-first OKLCH palette v1.1.0 (V2)** is the active component palette. It has eight opaque ten-step families and two separate page canvases in each theme. The original bundle’s version, import date, SHA-256, and fixed hue anchors are recorded in the option JSON; see [the source guide](../../tokens/README.md#active-color-provenance-and-contracts). Geist is a role-structure reference, not the source of these color values.

Steps 1–3 are backgrounds, 4–5 decorative borders, 6 meaningful borders/focus, 7–8 strong fills, and 9–10 text/icons. `neutral` replaces `gray`; the supplementary `gray-alpha` scale is derived from those neutrals for shadows or overlays where the background should show through. Its P3 representation uses zero-chroma OKLCH with alpha; sRGB fallbacks are generated alongside it. Opaque neutral remains the default for text, icons, fills, borders and dividers. `options.onFill.<family>.7/8` supplies explicit text colors for strong fills; never assume white or reuse steps 9/10 over a fill. Backgrounds remain independent of the ten-step scales.

Even keeps primary actions neutral, focus/selection blue, and error/warning/success/info red/amber/green/blue. Actions use neutral 7/8 and their paired foregrounds; filled boundaries use the step-9 `fill.border` decisions, including a persistent `action.border`. Subtle control boundaries and focus retain step 6. The modal scrim remains a separate overlay option. Color must never be the only status cue.

`contrastPairs` lists specific approved pairings: text targets 4.5:1; focus and control boundaries target 3:1 against their listed adjacent surfaces. Pairs with an `underlay` describe a translucent overlay; contrast uses the source-over composite rather than treating the transparent fill as opaque. Tests use Color.js WCAG contrast for sRGB and wide-gamut values, with browser-painted composite checks. This does not establish whole-component accessibility or approve arbitrary combinations. Chromium contrast auditing is enabled for every story in both themes, including portalled content.

Import `./generated/tokens.css` once at the host and opt in with `data-even-theme`. No global reset or root font-size override is emitted. Theme aliases rebind at nested boundaries. Storybook applies the selected theme to HTML, and shared component styles consume decision aliases.
