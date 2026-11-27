import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";
import { createTokenConfig } from "../../style-dictionary.config";
import {
  dimensionOptions,
  dimensionDecisions,
  strokeOptions,
  radiusOptions,
} from "./dimensions";

async function inMemory(tokens) {
  const config = createTokenConfig();
  return new StyleDictionary({
    ...config,
    source: [],
    include: [],
    tokens,
  }).getPlatformTokens("css");
}
test("motion aliases compile DTCG durations and curves and propagate option edits", async () => {
  const tokens = {
    options: {
      duration: {
        short: { $type: "duration", $value: { value: 200, unit: "ms" } },
      },
      easing: { settle: { $type: "cubicBezier", $value: [0.19, 1, 0.22, 1] } },
    },
    decision: {
      motion: {
        duration: {
          enter: { $type: "duration", $value: "{options.duration.short}" },
        },
        easing: {
          enter: { $type: "cubicBezier", $value: "{options.easing.settle}" },
        },
      },
    },
  };
  const values = async () =>
    Object.fromEntries(
      (await inMemory(tokens)).allTokens.map((token) => [
        token.path.join("."),
        token.$value,
      ]),
    );
  const first = await values();
  expect(first["decision.motion.duration.enter"]).toBe("0.2s");
  expect(first["decision.motion.easing.enter"]).toBe(
    "cubic-bezier(0.19, 1, 0.22, 1)",
  );
  tokens.options.duration.short.$value = { value: 0.25, unit: "s" };
  tokens.options.easing.settle.$value = [0, 0, 1, 1];
  const edited = await values();
  expect(edited["decision.motion.duration.enter"]).toBe("0.25s");
  expect(edited["decision.motion.easing.enter"]).toBe(
    "cubic-bezier(0, 0, 1, 1)",
  );
});
test("layout dimensions stay on the rem scale while pill geometry uses a separate full-radius option", async () => {
  expect(dimensionOptions.map((token) => Number(token.key))).toEqual([
    0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128, 192, 256, 384, 512,
    640, 768,
  ]);
  for (const token of dimensionOptions)
    expect(parseFloat(token.value) * 16).toBe(Number(token.key));
  for (const token of dimensionDecisions) {
    if (token.name === "size.radius.pill") {
      expect(token.reference).toBe("options.radius.full");
      expect(token.value).toBe(
        radiusOptions.find((option) => option.key === "radius.full").value,
      );
      continue;
    }
    expect(token.reference).toMatch(
      /^options\.(dimension\.\d+|stroke\.(thin|strong))$/,
    );
    expect(token.value).toBe(
      [...dimensionOptions, ...strokeOptions].find(
        (option) =>
          token.reference ===
          `options.${option.key.startsWith("stroke.") ? option.key : `dimension.${option.key}`}`,
      ).value,
    );
  }
  const sizing = JSON.parse(
    await readFile(
      new URL("../../tokens/decisions/sizing.json", import.meta.url),
      "utf8",
    ),
  );
  expect(sizing.decision.size.control.default.$value).toBe(
    "{options.dimension.40}",
  );
});
test("Style Dictionary propagates an option edit through its decision alias", async () => {
  const tokens = {
    options: {
      dimension: {
        16: { $type: "dimension", $value: { value: 1, unit: "rem" } },
      },
    },
    decision: {
      space: {
        inset: { $type: "dimension", $value: "{options.dimension.16}" },
      },
    },
  };
  let dictionary = await inMemory(tokens);
  expect(
    dictionary.allTokens.find((token) => token.path[0] === "decision").$value,
  ).toBe("1rem");
  tokens.options.dimension[16].$value.value = 1.25;
  dictionary = await inMemory(tokens);
  expect(
    dictionary.allTokens.find((token) => token.path[0] === "decision").$value,
  ).toBe("1.25rem");
});
test("broken or circular aliases fail the build instead of emitting invalid CSS", async () => {
  await expect(
    inMemory({
      decision: {
        space: { gap: { $type: "dimension", $value: "{options.missing}" } },
      },
    }),
  ).rejects.toThrow();
  await expect(
    inMemory({
      decision: {
        space: {
          a: { $type: "dimension", $value: "{decision.space.b}" },
          b: { $type: "dimension", $value: "{decision.space.a}" },
        },
      },
    }),
  ).rejects.toThrow();
});
