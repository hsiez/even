import { readFile, writeFile } from "node:fs/promises";
import Color from "colorjs.io";
import { format } from "prettier";

for (const theme of ["light", "dark"])
  for (const gamut of ["srgb", "p3"]) {
    const suffix = `${theme}${gamut === "p3" ? ".p3" : ""}.json`;
    const source = `colors.${suffix}`;
    const input = JSON.parse(
      await readFile(
        new URL(`../tokens/options/${source}`, import.meta.url),
        "utf8",
      ),
    );
    const colors = input.options.color;
    function gray(token) {
      const value = token.$value;
      const color = new Color(value.colorSpace, value.components, value.alpha);
      const [, chroma] = color.to("oklch").coords;
      if (value.alpha !== 1 || chroma > 1e-6)
        throw new Error(
          `${source}: derivation requires opaque, zero-chroma source colors`,
        );
      const channels = color.to("srgb").coords;
      return channels.reduce((sum, channel) => sum + channel, 0) / 3;
    }
    const canvas = gray(colors.background[1]);
    const ink = theme === "light" ? 0 : 1;
    const scale = {
      $type: "color",
      $description:
        "Gray-alpha for shadows or overlays when the background must show through. Matches neutral steps over background.1; use opaque neutral by default.",
    };
    for (const [step, token] of Object.entries(colors.neutral)) {
      if (step.startsWith("$")) continue;
      const alpha = Number(
        ((gray(token) - canvas) / (ink - canvas)).toFixed(6),
      );
      if (!(alpha > 0 && alpha < 1))
        throw new Error(
          `${source}: step ${step} cannot be represented translucently with this ink`,
        );
      scale[step] = {
        $value: {
          colorSpace: gamut === "p3" ? "oklch" : "srgb",
          components: gamut === "p3" ? [ink, 0, 0] : [ink, ink, ink],
          alpha,
        },
        $description: `Translucent equivalent of neutral.${step} over background.1.`,
      };
    }
    const output = {
      $extensions: {
        "com.even.derivation": {
          source,
          scale: "options.color.neutral",
          canvas: "options.color.background.1",
          ink: theme === "light" ? "oklch(0 0 0)" : "oklch(1 0 0)",
          method:
            "Zero-chroma OKLCH endpoints; solve encoded-sRGB source-over for alpha, rounded to 6 decimals.",
          usage:
            "Shadows or overlays where the background should show through. Dark white-alpha overlays lighten; cast shadows and modal dimming require black.",
          skill: "https://github.com/jakubkrehel/oklch-skill",
        },
      },
      options: { color: { "gray-alpha": scale } },
    };
    const path = new URL(
      `../tokens/options/gray-alpha.${suffix}`,
      import.meta.url,
    );
    const content = await format(JSON.stringify(output), { parser: "json" });
    if (process.argv.includes("--check")) {
      if ((await readFile(path, "utf8")) !== content)
        throw new Error(
          `Stale gray-alpha.${suffix}; run npm run tokens:derive-alpha, then npm run tokens:generate.`,
        );
    } else await writeFile(path, content);
  }
