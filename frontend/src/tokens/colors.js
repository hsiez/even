import manifest from "./generated/token-manifest.json" with { type: "json" };

export const source = manifest.source;
export const themes = ["light", "dark"];
function palette(theme, gamut) {
  const result = {};
  for (const [path, token] of Object.entries(manifest.themes[theme][gamut])) {
    if (!path.startsWith("options.color.")) continue;
    if (
      gamut === "p3" &&
      token.value === manifest.themes[theme].srgb[path]?.value
    )
      continue;
    const [, , family, step] = path.split(".");
    (result[family] ??= {})[step] = token.value;
  }
  return result;
}
export const palettes = Object.fromEntries(
  themes.map((theme) => [theme, palette(theme, "srgb")]),
);
export const wideGamutPalettes = Object.fromEntries(
  themes.map((theme) => [theme, palette(theme, "p3")]),
);
export const scaleNames = Object.keys(palettes.light);
export const stepRoles = {
  1: "Component background",
  2: "Hover background",
  3: "Active background",
  4: "Default border",
  5: "Hover border",
  6: "Active border",
  7: "Strong background",
  8: "Strong hover background",
  9: "Secondary text and icons",
  10: "Primary text and icons",
};

// Read-only views of Style Dictionary output. Author values/aliases in tokens/**/*.json.
export const semanticColors = Object.fromEntries(
  Object.entries(manifest.themes.light.srgb)
    .filter(([path]) => path.startsWith("decision.color."))
    .map(([path, token]) => [
      path.slice("decision.color.".length),
      token.reference.replace(/^options\.(color\.)?/, ""),
    ]),
);

export const contrastPairs = [
  ...["surface.page", "surface.secondary"].map((background) => ({
    foreground: "text.link",
    background,
    minimum: 4.5,
    purpose: "Navigational text link",
  })),
  ...[
    "surface.page",
    "surface.secondary",
    "surface.control",
    "surface.hover",
    "surface.active",
  ].flatMap((background) => [
    {
      foreground: "text.primary",
      background,
      minimum: 4.5,
      purpose: "Body text",
    },
    {
      foreground: "text.secondary",
      background,
      minimum: 4.5,
      purpose: "Secondary body text",
    },
    {
      foreground: "focus.ring",
      background,
      minimum: 3,
      purpose: "Focus indicator against this surface",
    },
    {
      foreground: "border.control",
      background,
      minimum: 3,
      purpose: "Essential control boundary against this surface",
    },
  ]),
  {
    foreground: "selection.foreground",
    background: "selection.background",
    minimum: 4.5,
    purpose: "Selected row text",
  },
  {
    foreground: "action.foreground",
    background: "action.background",
    minimum: 4.5,
    purpose: "Solid action label",
  },
  {
    foreground: "action.foreground",
    background: "action.hover",
    minimum: 4.5,
    purpose: "Hovered solid action label",
  },
  ...["error", "warning", "success", "info"].map((status) => ({
    foreground: `status.${status}.text`,
    background: `status.${status}.surface`,
    minimum: 4.5,
    purpose: `${status} notice text`,
  })),
];

export function paletteVariable(family, step) {
  return `--${manifest.themes.light.srgb[`options.color.${family}.${step}`].name}`;
}
export function semanticVariable(name) {
  return `--${manifest.themes.light.srgb[`decision.color.${name}`].name}`;
}
export function resolveColor(theme, reference, gamut = "srgb") {
  const tokens = manifest.themes[theme]?.[gamut];
  return (
    tokens?.[`decision.color.${reference}`] ??
    tokens?.[`options.color.${reference}`]
  )?.value;
}
