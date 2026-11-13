import Color from "colorjs.io";
import { fileURLToPath } from "node:url";

const sourcePath = (name) =>
  fileURLToPath(new URL(`./tokens/${name}`, import.meta.url));

// Keep the CSS API stable while naming JSON explicitly as options and decisions.
export function tokenCssName(path) {
  if (path[0] === "options" && path[1] === "color")
    return ["even", "palette", ...path.slice(2)].join("-");
  if (path[0] === "options" && path[1] === "dimension")
    return ["even", "dimension", ...path.slice(2)].join("-");
  if (path[0] === "decision" && path[1] === "color")
    return ["even", ...path.slice(2)].join("-");
  return ["even", ...path.slice(1)].join("-");
}

export function createTokenConfig({ theme = "light", gamut = "srgb" } = {}) {
  if (!["light", "dark"].includes(theme) || !["srgb", "p3"].includes(gamut))
    throw new Error("Unknown theme or gamut.");
  const base = [
    sourcePath(`options/colors.${theme}.json`),
    sourcePath("options/dimensions.json"),
    sourcePath("options/overlays.json"),
    sourcePath("decisions/*.json"),
  ];
  return {
    usesDtcg: true,
    ...(gamut === "srgb"
      ? { source: base }
      : {
          include: base,
          source: [sourcePath(`options/colors.${theme}.p3.json`)],
        }),
    log: {
      verbosity: "silent",
      warnings: "error",
      errors: { brokenReferences: "throw" },
    },
    hooks: {
      transforms: {
        "even/name": {
          type: "name",
          transform: (token) => tokenCssName(token.path),
        },
        "even/color-css": {
          type: "value",
          filter: (token) => token.$type === "color",
          transform: (token) => {
            const value = token.$value;
            // The default color/css transform clips wide-gamut colors to hex.
            return new Color(
              value.colorSpace,
              value.components,
              value.alpha ?? 1,
            ).toString({
              format: value.colorSpace === "srgb" ? "rgb" : "oklch",
              precision: 12,
            });
          },
        },
      },
    },
    platforms: {
      css: {
        transforms: ["even/name", "even/color-css", "size/rem"],
        files: [
          {
            destination: "tokens.css",
            format: "css/variables",
            ...(gamut === "p3"
              ? {
                  filter: (token) =>
                    token.filePath ===
                    sourcePath(`options/colors.${theme}.p3.json`),
                }
              : {}),
            options: {
              selector: `[data-even-theme="${theme}"]`,
              showFileHeader: false,
              outputReferences: true,
            },
          },
        ],
      },
    },
  };
}
