import manifest from "./generated/token-manifest.json" with { type: "json" };
import { createColorModel } from "./colorModel.js";

export const {
  source,
  themes,
  palettes,
  wideGamutPalettes,
  scaleNames,
  semanticColors,
  componentScales,
  resolveColor,
  paletteVariable,
  semanticVariable,
  onFillVariable,
  resolveOnFill,
} = createColorModel(manifest);

export const stepRoles = {
  1: "Component background",
  2: "Hover background",
  3: "Active background",
  4: "Default border",
  5: "Hover border",
  6: "Meaningful border / focus",
  7: "Strong background",
  8: "Strong hover background",
  9: "Text and icons",
  10: "Strong text and icons",
};

export const contrastPairs = [
  ...[
    "surface.page",
    "surface.secondary",
    "surface.control",
    "surface.hover",
  ].map((underlay) => ({
    foreground: "label.foreground",
    background: "label.background",
    underlay,
    minimum: 4.5,
    purpose: "Passive label text on the composited overlay",
  })),
  {
    foreground: "selection.foreground",
    background: "label.selected-background",
    underlay: "selection.background",
    minimum: 4.5,
    purpose: "Label text over the selected row's composited overlay",
  },
  ...[
    "surface.page",
    "surface.secondary",
    "surface.control",
    "surface.hover",
    "surface.active",
    "selection.background",
  ].map((background) => ({
    foreground: "hierarchy.guide",
    background,
    minimum: 3,
    purpose: "Meaningful hierarchy connectors and nesting guides",
  })),
  ...["key", "string", "number", "literal", "punctuation"].flatMap((kind) =>
    ["surface.page", "surface.secondary"].map((background) => ({
      foreground: `syntax.${kind}`,
      background,
      minimum: 4.5,
      purpose: "Readable JSON syntax text",
    })),
  ),
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
    {
      foreground: "border.focus",
      background,
      minimum: 3,
      purpose: "In-place focus boundary against this surface",
    },
    {
      foreground: "border.invalid",
      background,
      minimum: 3,
      purpose: "Invalid input boundary against this surface",
    },
    {
      foreground: "border.interaction",
      background,
      minimum: 3,
      purpose: "Interactive edge against this surface",
    },
    {
      foreground: "selection.indicator",
      background,
      minimum: 3,
      purpose: "Persistent selection mark against this surface",
    },
    {
      foreground: "action.border",
      background,
      minimum: 3,
      purpose: "Filled action boundary against this surface",
    },
  ]),
  {
    foreground: "selection.foreground",
    background: "selection.background",
    minimum: 4.5,
    purpose: "Selected row text",
  },
  {
    foreground: "focus.ring",
    background: "selection.background",
    minimum: 3,
    purpose: "Inset keyboard focus on a selected row or item",
  },
  {
    foreground: "action.foreground",
    background: "action.background",
    minimum: 4.5,
    purpose: "Solid action label",
  },
  {
    foreground: "action.hover-foreground",
    background: "action.hover",
    minimum: 4.5,
    purpose: "Hovered solid action label",
  },
  ...["error", "warning", "success", "info"].flatMap((status) =>
    ["surface", "compact-surface"].map((surface) => ({
      foreground: `status.${status}.text`,
      background: `status.${status}.${surface}`,
      minimum: 4.5,
      purpose: `${status} ${surface === "surface" ? "notice" : "compact status"} text`,
    })),
  ),
];
