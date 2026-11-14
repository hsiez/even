# Token consumers and generated outputs

The source of truth is now [`frontend/tokens`](../../tokens/README.md): JSON options and decisions for colors, spacing and sizing. Read that guide for the scale, provenance, naming and Style Dictionary build process.

- `generated/tokens.css`: generated opt-in CSS custom properties. Do not edit by hand.
- `generated/token-manifest.json`: generated resolved values, alias relationships, descriptions and CSS names for documentation/tests. Do not edit by hand.
- `colors.js` / `dimensions.js`: read-only views of the generated manifest, plus color role/contrast test definitions. No authored token values or decision aliases live in JavaScript.
- `ColorGrid/` / `DimensionGrid/`: Storybook documentation, including isolated presentation CSS; the component library consumes decision tokens in `../components/components.css`.

## Color contract

The Geist snapshot was retrieved 2026-11-13; provenance is recorded in the option JSON. Original values were converted to DTCG color objects without materially changing the palette. Step 1 corresponds to Geist's `--ds-*-100`, step 10 to `--ds-*-1000`. The two background steps are separate page/surface colors. Wide-gamut overrides remain conditional on P3 capability and OKLCH support.

Geist's component steps 1–3 are backgrounds, 4–6 borders, 7–8 strong fills, 9–10 secondary/primary text and icons. Gray-alpha depends on compositing and is not covered by opaque contrast guarantees.

Even's current decisions keep solid actions neutral, focus/selection blue, and error/warning/success/info red/amber/green/blue. Decorative borders are intentionally subtle; use the separately tested `border.control` for necessary boundaries. Color must never be the only status cue.

`contrastPairs` lists specific approved pairings: text targets 4.5:1; focus and control boundaries target 3:1 against their listed adjacent surfaces. Tests use Color.js WCAG contrast for sRGB and wide-gamut values. This does not establish whole-component accessibility or approve arbitrary combinations. Chromium contrast auditing is enabled for every story in both themes, including portalled content.

Import `./generated/tokens.css` once at the host and opt in with `data-even-theme`. No global reset or root font-size override is emitted. Theme aliases rebind at nested boundaries. Storybook applies the selected theme to HTML, and shared component styles consume decision aliases.
