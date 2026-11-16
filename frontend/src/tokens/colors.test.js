import { expect, test } from "vitest";
import Color from "colorjs.io";
import {
  palettes,
  themes,
  scaleNames,
  semanticColors,
  contrastPairs,
  resolveColor,
  componentScales,
  resolveOnFill,
} from "./colors";

test("both themes provide eight opaque scales, gray-alpha, separate canvases, and resolving semantic aliases", () => {
  expect(scaleNames).toHaveLength(10);
  expect(componentScales).toEqual([
    "blue",
    "green",
    "amber",
    "red",
    "teal",
    "purple",
    "pink",
    "neutral",
  ]);
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

test("custom palette roles and on-fill foregrounds pass all 544 required pairings", () => {
  const failures = [];
  let checks = 0;
  for (const theme of themes) {
    for (const family of componentScales) {
      for (const gamut of ["srgb", "p3"]) {
        const surfaces = [
          "background.1",
          "background.2",
          ...[1, 2, 3].map((step) => `${family}.${step}`),
        ];
        function check(foreground, background, minimum, role) {
          checks++;
          const ratio = Color.contrastWCAG21(
            new Color(foreground),
            new Color(background),
          );
          if (ratio < minimum)
            failures.push({ theme, family, gamut, role, ratio, minimum });
        }
        for (const [step, minimum] of [
          [6, 3],
          [9, 4.5],
          [10, 7],
        ])
          for (const surface of surfaces)
            check(
              resolveColor(theme, `${family}.${step}`, gamut),
              resolveColor(theme, surface, gamut),
              minimum,
              `${step} on ${surface}`,
            );
        for (const step of [7, 8])
          check(
            resolveOnFill(theme, family, step, gamut),
            resolveColor(theme, `${family}.${step}`, gamut),
            4.5,
            `foreground on ${step}`,
          );
      }
    }
  }
  expect(checks).toBe(544);
  expect(failures).toEqual([]);
});

test("palette keeps fixed hue anchors, opaque colors, and bounded sRGB/P3 output", () => {
  const anchors = {
    blue: 255,
    green: 155,
    amber: 80,
    red: 25,
    teal: 190,
    purple: 305,
    pink: 350,
    neutral: 0,
  };
  for (const theme of themes) {
    for (const family of [...componentScales, "background"]) {
      const steps =
        family === "background" ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      for (const step of steps) {
        const fallback = new Color(resolveColor(theme, `${family}.${step}`));
        expect(fallback.alpha).toBe(1);
        expect(
          fallback
            .to("srgb")
            .coords.every((channel) => channel >= 0 && channel <= 1),
        ).toBe(true);
        const source = new Color(
          resolveColor(theme, `${family}.${step}`, "p3"),
        );
        expect(source.alpha).toBe(1);
        expect(
          source
            .to("p3-linear")
            .coords.every((channel) => channel >= -1e-8 && channel <= 1 + 1e-8),
        ).toBe(true);
        const [, chroma, hue] = source.to("oklch").coords;
        if (family === "neutral" || family === "background")
          expect(chroma).toBeCloseTo(0, 7);
        else expect(hue).toBeCloseTo(anchors[family], 7);
      }
    }
  }
});

test("gray-alpha is achromatic, translucent, increases in strength, and composites to its neutral counterpart", () => {
  for (const theme of themes)
    for (const gamut of ["srgb", "p3"]) {
      const canvas = new Color(resolveColor(theme, "background.1", gamut)).to(
        "srgb",
      );
      let previousAlpha = 0;
      for (let step = 1; step <= 10; step++) {
        const alpha = new Color(
          resolveColor(theme, `gray-alpha.${step}`, gamut),
        );
        expect(alpha.to("oklch").coords[1]).toBeCloseTo(0, 7);
        expect(alpha.alpha).toBeGreaterThan(previousAlpha);
        expect(alpha.alpha).toBeLessThan(1);
        previousAlpha = alpha.alpha;
        const ink = alpha.to("srgb").coords;
        const target = new Color(
          resolveColor(theme, `neutral.${step}`, gamut),
        ).to("srgb").coords;
        ink.forEach((channel, index) => {
          expect(channel).toBeCloseTo(theme === "light" ? 0 : 1, 7);
          const composite =
            channel * alpha.alpha + canvas.coords[index] * (1 - alpha.alpha);
          expect(Math.abs(composite - target[index])).toBeLessThan(1e-6);
        });
      }
    }
});

test("strong-fill boundary decisions pass all 512 adjacency checks including clipped sRGB", () => {
  const clipped = (value) =>
    new Color(
      "srgb",
      new Color(value)
        .to("srgb")
        .coords.map(
          (channel) =>
            Math.round(Math.max(0, Math.min(1, channel)) * 255) / 255,
        ),
    );
  let checks = 0;
  const failures = [];
  for (const theme of themes)
    for (const family of componentScales)
      for (const gamut of ["srgb", "p3"]) {
        const border = resolveColor(theme, `fill.border.${family}`, gamut);
        const surfaces = [
          "background.1",
          "background.2",
          ...[1, 2, 3].map((step) => `${family}.${step}`),
          ...[1, 2, 3].map((step) => `neutral.${step}`),
        ];
        for (const fillStep of [7, 8])
          for (const surface of surfaces) {
            const background = resolveColor(theme, surface, gamut);
            const ratio = Color.contrastWCAG21(
              new Color(border),
              new Color(background),
            );
            const clippedRatio = Color.contrastWCAG21(
              clipped(border),
              clipped(background),
            );
            checks++;
            if (ratio < 3 || clippedRatio < 3)
              failures.push({
                theme,
                family,
                gamut,
                fillStep,
                surface,
                ratio,
                clippedRatio,
              });
          }
      }
  expect(checks).toBe(512);
  expect(failures).toEqual([]);
});
