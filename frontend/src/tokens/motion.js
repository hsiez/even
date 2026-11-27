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
export const interactionDelays = rows("decision.interaction.delay.");

function milliseconds(value) {
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/);
  return match ? Number(match[1]) * (match[2] === "s" ? 1000 : 1) : null;
}

function readDuration(element, token) {
  return (
    milliseconds(
      getComputedStyle(element).getPropertyValue(`--${token.name}`),
    ) ?? milliseconds(token.value)
  );
}

export function readInteractionDelay(element, purpose) {
  const token = tokens[`decision.interaction.delay.${purpose}`];
  if (!token) throw new Error(`Unknown interaction delay: ${purpose}`);
  return readDuration(element, token);
}

export function readMotionTiming(element, purpose) {
  const duration = tokens[`decision.motion.duration.${purpose}`];
  const easing = tokens[`decision.motion.easing.${purpose}`];
  if (!duration || !easing)
    throw new Error(`Unknown motion purpose: ${purpose}`);
  const style = getComputedStyle(element);
  const resolvedEasing = style.getPropertyValue(`--${easing.name}`).trim();
  return {
    duration: readDuration(element, duration),
    easing: resolvedEasing || easing.value,
  };
}
