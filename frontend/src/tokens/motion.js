import manifest from "./generated/token-manifest.json" with { type: "json" };

const tokens = manifest.themes.light.srgb;
const rows = (prefix) =>
  Object.entries(tokens)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, token]) => ({
      ...token,
      name: path.slice(prefix.length),
      variable: `--${token.name}`,
    }));

export const motionOptions = [
  ...rows("options.duration.").map((token) => ({
    ...token,
    category: "duration",
  })),
  ...rows("options.easing.").map((token) => ({ ...token, category: "easing" })),
];
export const motionDecisions = rows("decision.motion.");

function milliseconds(value) {
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/);
  return match ? Number(match[1]) * (match[2] === "s" ? 1000 : 1) : null;
}

// WAAPI cannot consume var(). Read the same resolved decisions CSS uses,
// including caller overrides. The generated manifest supplies unthemed defaults.
export function readMotionTiming(element, purpose) {
  const duration = tokens[`decision.motion.duration.${purpose}`];
  const easing = tokens[`decision.motion.easing.${purpose}`];
  if (!duration || !easing)
    throw new Error(`Unknown motion purpose: ${purpose}`);
  const style = getComputedStyle(element);
  const resolvedEasing = style.getPropertyValue(`--${easing.name}`).trim();
  return {
    duration:
      milliseconds(style.getPropertyValue(`--${duration.name}`)) ??
      milliseconds(duration.value),
    easing: resolvedEasing || easing.value,
  };
}
