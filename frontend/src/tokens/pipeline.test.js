// @vitest-environment node
import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";
import { createTokenConfig } from "../../style-dictionary.config";
import { dimensionOptions, dimensionDecisions } from "./dimensions";

async function inMemory(tokens) {
  const config = createTokenConfig();
  return new StyleDictionary({
    ...config,
    source: [],
    include: [],
    tokens,
  }).getPlatformTokens("css");
}
test("dimension options are rem values and decisions are JSON references into the same scale", async () => {
  expect(dimensionOptions.map((token) => Number(token.key))).toEqual([
    0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128, 192, 256, 384, 512,
    640, 768,
  ]);
  for (const token of dimensionOptions)
    expect(parseFloat(token.value) * 16).toBe(Number(token.key));
  for (const token of dimensionDecisions) {
    expect(token.reference).toMatch(/^options\.dimension\.\d+$/);
    expect(token.value).toBe(
      dimensionOptions.find(
        (option) => option.key === token.reference.split(".").at(-1),
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
