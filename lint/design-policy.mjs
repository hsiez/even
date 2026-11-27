import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import valueParser from "postcss-value-parser";
import colors from "color-name";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(
    `${root}frontend/src/tokens/generated/token-manifest.json`,
    "utf8",
  ),
);
export const decisions = new Set(
  Object.entries(manifest.themes.light.srgb)
    .filter(([path]) => path.startsWith("decision."))
    .map(([, token]) => `--${token.name}`),
);
const options = new Set(
  Object.entries(manifest.themes.light.srgb)
    .filter(([path]) => path.startsWith("options."))
    .map(([, token]) => `--${token.name}`),
);
const locals = new Set();
for (const file of globSync("frontend/src/**/*.css", {
  cwd: root,
  exclude: ["**/generated/**"],
})) {
  for (const match of readFileSync(`${root}${file}`, "utf8").matchAll(
    /(--[\w-]+)\s*:/g,
  ))
    locals.add(match[1]);
}
const typography =
  /^(font(?:-size|-weight|-style|-stretch|-variant)?|line-height|letter-spacing|text-underline-offset)$/;
const colorFunctions =
  /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk)$/i;
const colorWords = new Set(Object.keys(colors));
const runtimeVariables = new Set([
  "--even-tab-count",
  "--even-active-tab-width",
  "--even-tab-viewport-start",
  "--even-tab-viewport-width",
  "--even-tab-close-offset",
  "--even-tab-row-height",
]);
export function cssProperty(name) {
  return name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
export function designProblems(
  property,
  value,
  { knownLocals = locals, preview = false } = {},
) {
  const prop = cssProperty(property);
  if (preview) return [];
  const problems = new Set();
  if (
    prop === "font" &&
    !/^(inherit|initial|unset|revert|revert-layer)$/.test(String(value)) &&
    !/var\(--even-font-/.test(String(value))
  )
    problems.add("Use a font-family decision in font shorthands.");
  valueParser(String(value)).walk((node) => {
    if (node.type === "string" && prop === "font-family")
      problems.add("Use a font-family decision.");
    if (node.type === "function" && colorFunctions.test(node.value) && !preview)
      problems.add("Use a color decision instead of a literal color.");
    if (
      node.type === "function" &&
      /^(cubic-bezier|linear)$/i.test(node.value) &&
      !preview
    )
      problems.add("Use a motion easing decision.");
    if (node.type !== "word") return;
    const word = node.value;
    if (word.startsWith("--")) {
      if (
        options.has(word) ||
        /^--even-(?:color|dimension|duration|easing|options)-/.test(word)
      )
        problems.add("Use a decision token, not a foundation option.");
      else if (
        word.startsWith("--even-") &&
        !decisions.has(word) &&
        !knownLocals.has(word) &&
        !runtimeVariables.has(word)
      )
        problems.add(`Unknown decision or local variable: ${word}.`);
    }
    if (preview) return;
    if (
      /^#[\da-f]{3,8}$/i.test(word) ||
      (colorWords.has(word.toLowerCase()) &&
        !/^(?:-webkit-)?mask(?:-image)?$/.test(prop))
    )
      problems.add("Use a color decision instead of a literal color.");
    const dimension = word.match(
      /^(-?(?:\d*\.)?\d+)(px|rem|em|ex|ch|cap|lh|pt|pc|cm|mm|in|ms|s)$/i,
    );
    if (dimension && Number(dimension[1]) !== 0 && !typography.test(prop))
      problems.add(
        "Use a spacing, sizing or duration decision instead of a literal dimension.",
      );
    if (
      /^(transition|animation|easing)/.test(prop) &&
      /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$/.test(
        word,
      )
    )
      problems.add("Use a motion easing decision.");
    if (
      prop === "font-family" &&
      !word.startsWith("--") &&
      !/^(inherit|initial|unset|revert|revert-layer)$/.test(word)
    )
      problems.add("Use a font-family decision.");
  });
  return [...problems];
}

export function isDesignPreview(filename) {
  return (
    /frontend\/src\/tokens\//.test(filename) ||
    filename.endsWith("WorkbenchTabs.stories.jsx")
  );
}
