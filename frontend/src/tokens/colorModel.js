export function createColorModel(manifest) {
  const themes = ["light", "dark"];
  function palette(theme, gamut) {
    const result = {};
    for (const [path, token] of Object.entries(manifest.themes[theme][gamut])) {
      if (!path.startsWith("options.color.")) continue;
      if (
        gamut === "p3" &&
        token.value === manifest.themes[theme].srgb[path]?.value
      )
        continue;
      const [, , family, step] = path.split(".");
      (result[family] ??= {})[step] = token.value;
    }
    return result;
  }
  const palettes = Object.fromEntries(
    themes.map((theme) => [theme, palette(theme, "srgb")]),
  );
  const wideGamutPalettes = Object.fromEntries(
    themes.map((theme) => [theme, palette(theme, "p3")]),
  );
  const scaleNames = Object.keys(palettes.light);
  const semanticColors = Object.fromEntries(
    Object.entries(manifest.themes.light.srgb)
      .filter(([path]) => path.startsWith("decision.color."))
      .map(([path, token]) => [
        path.slice("decision.color.".length),
        token.reference.replace(/^options\.(color\.)?/, ""),
      ]),
  );
  function resolveColor(theme, reference, gamut = "srgb") {
    const tokens = manifest.themes[theme]?.[gamut];
    return (
      tokens?.[`decision.color.${reference}`] ??
      tokens?.[`options.color.${reference}`]
    )?.value;
  }
  return {
    source: manifest.source,
    themes,
    palettes,
    wideGamutPalettes,
    scaleNames,
    semanticColors,
    componentScales: scaleNames.filter(
      (name) => name !== "background" && name !== "gray-alpha",
    ),
    resolveColor,
    paletteVariable: (family, step) =>
      `--${manifest.themes.light.srgb[`options.color.${family}.${step}`].name}`,
    semanticVariable: (name) =>
      `--${manifest.themes.light.srgb[`decision.color.${name}`].name}`,
    onFillVariable: (family, step) =>
      `--${manifest.themes.light.srgb[`options.onFill.${family}.${step}`].name}`,
    resolveOnFill: (theme, family, step, gamut = "srgb") =>
      manifest.themes[theme][gamut][`options.onFill.${family}.${step}`].value,
  };
}
