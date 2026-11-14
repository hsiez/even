import { expect, test } from "vitest";
import Color from "colorjs.io";
import {
  palettes,
  themes,
  scaleNames,
  semanticColors,
  contrastPairs,
  resolveColor,
} from "./colors";

test("both themes provide the entire Geist grid and all semantic references resolve", () => {
  expect(scaleNames).toHaveLength(10);
  for (const theme of themes) {
    for (const [family, steps] of Object.entries(palettes[theme])) {
      expect(Object.keys(steps)).toHaveLength(family === "background" ? 2 : 10);
      for (const value of Object.values(steps))
        expect(() => new Color(value)).not.toThrow();
    }
    for (const name of Object.keys(semanticColors))
      for (const gamut of ["srgb", "p3"])
        expect(() => new Color(resolveColor(theme, name, gamut))).not.toThrow();
  }
});
for (const theme of themes)
  for (const gamut of ["srgb", "p3"]) {
    test(`${theme} ${gamut}: intended text, selection, action, focus and control-boundary pairings meet contrast targets`, () => {
      const failures = contrastPairs.flatMap((pair) => {
        const ratio = Color.contrastWCAG21(
          new Color(resolveColor(theme, pair.foreground, gamut)),
          new Color(resolveColor(theme, pair.background, gamut)),
        );
        return ratio < pair.minimum
          ? [{ ...pair, ratio: Number(ratio.toFixed(3)) }]
          : [];
      });
      expect(failures).toEqual([]);
    });
  }
