import manifest from "./generated/token-manifest.json" with { type: "json" };

const tokens = manifest.themes.light.srgb;
export const dimensionOptions = Object.entries(tokens)
  .filter(([path]) => path.startsWith("options.dimension."))
  .map(([path, token]) => ({
    key: path.split(".").at(-1),
    variable: `--${token.name}`,
    value: token.value,
    description: token.description,
  }));
export const dimensionDecisions = Object.entries(tokens)
  .filter(
    ([path]) =>
      path.startsWith("decision.space.") || path.startsWith("decision.size."),
  )
  .map(([path, token]) => ({
    category: path.split(".")[1],
    name: path.slice("decision.".length),
    variable: `--${token.name}`,
    value: token.value,
    reference: token.reference,
    description: token.description,
  }));
