import React from "react";
import Color from "colorjs.io";
import * as currentColors from "../colors";
import "../generated/tokens.css";
import "./ColorGrid.css";

export function ColorGrid({ theme = "light", style, label }) {
  const {
    palettes,
    wideGamutPalettes,
    themes,
    scaleNames,
    componentScales,
    onFillVariable,
    resolveOnFill,
    stepRoles,
    semanticColors,
    contrastPairs,
    paletteVariable,
    semanticVariable,
    resolveColor,
    source,
  } = currentColors;
  if (!themes.includes(theme))
    throw new Error("ColorGrid theme must be light or dark.");
  return (
    <section
      className="even-color-grid"
      data-even-theme={theme}
      style={style}
      aria-label={label ?? `${theme} color tokens`}
    >
      <header>
        <h2>{theme === "light" ? "Light" : "Dark"} color tokens</h2>
        <p>
          {source.name} · v{source.version} · imported {source.imported}.
          Numbered steps describe jobs, not a simple light-to-dark ramp.
        </p>
        <p>
          Swatches use wide-gamut overrides on supported displays. Values below
          each swatch are the sRGB fallback, followed by the optional wide-gamut
          value.
        </p>
        <p>
          Custom colors use fixed hue anchors and role curves. Geist supplies
          the role structure, not the color values.
        </p>
        <a href={source.roleReference}>
          Role structure reference: Geist colors
        </a>
      </header>
      <div
        className="even-color-grid__scroll"
        role="region"
        aria-label={`${label ?? theme} palette grid`}
        tabIndex={0}
      >
        <table>
          <caption>Palette scales and intended step roles</caption>
          <thead>
            <tr>
              <th scope="col">Scale</th>
              {Object.entries(stepRoles).map(([step, role]) => (
                <th scope="col" key={step}>
                  {step}
                  <small>{role}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scaleNames.map((family) => (
              <tr key={family} data-scale={family}>
                <th scope="row">
                  {family}
                  {family === "gray-alpha" && (
                    <small>Blend-only equivalents of neutral steps</small>
                  )}
                </th>
                {Array.from({ length: 10 }, (_, index) => {
                  const step = index + 1;
                  const value = palettes[theme][family][step];
                  const wide = wideGamutPalettes[theme][family]?.[step];
                  return (
                    <td key={step}>
                      {value ? (
                        <>
                          <div
                            className={
                              family === "gray-alpha"
                                ? "even-color-grid__alpha-base"
                                : undefined
                            }
                            aria-hidden="true"
                          >
                            <div
                              className="even-color-grid__swatch"
                              style={{
                                backgroundColor: `var(${paletteVariable(family, step)})`,
                              }}
                            />
                          </div>
                          <code>{paletteVariable(family, step)}</code>
                          <small>{value}</small>
                          {wide && <small>{wide}</small>}
                          {family === "gray-alpha" && (
                            <small>
                              {(new Color(value).alpha * 100).toFixed(2)}%
                              opacity (sRGB)
                            </small>
                          )}
                        </>
                      ) : (
                        <span>Not applicable</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Background steps 1–2 are page/surface backgrounds, separate from the
        ten-step component scales. The component scales are opaque. Gray-alpha
        is only for shadows or overlays where the background should show
        through; its split swatches show the page canvas on the left and blue
        step 3 on the right. Over the page canvas each step matches its opaque
        neutral. Dark-theme white-alpha lightens overlays; cast shadows and
        modal dimming need black, so the modal scrim remains separate. Steps 4–5
        are subtle decorative borders; use step 6 for a meaningful boundary.
        Filled surfaces use their explicit foreground below.
      </p>
      <details open>
        <summary>Strong fills and their paired foregrounds</summary>
        <p>
          Steps 7 and 8 have explicit foregrounds for each theme and family. Do
          not assume white text or reuse text steps 9–10 on a strong fill.
        </p>
        <table>
          <caption>Matching fill foregrounds</caption>
          <thead>
            <tr>
              <th scope="col">Fill</th>
              <th scope="col">Foreground</th>
              <th scope="col">Example</th>
              <th scope="col">sRGB / wide gamut ratio</th>
            </tr>
          </thead>
          <tbody>
            {componentScales.flatMap((family) =>
              [7, 8].map((step) => {
                const ratios = ["srgb", "p3"].map((gamut) =>
                  Color.contrastWCAG21(
                    new Color(resolveOnFill(theme, family, step, gamut)),
                    new Color(resolveColor(theme, `${family}.${step}`, gamut)),
                  ),
                );
                return (
                  <tr key={`${family}-${step}`}>
                    <th scope="row">
                      {family}.{step}
                    </th>
                    <td>
                      <code>{onFillVariable(family, step)}</code>
                      <small>{resolveOnFill(theme, family, step)}</small>
                    </td>
                    <td>
                      <span
                        className="even-color-grid__pair"
                        style={{
                          backgroundColor: `var(${paletteVariable(family, step)})`,
                          color: `var(${onFillVariable(family, step)})`,
                          border: resolveColor(theme, `fill.border.${family}`)
                            ? `1px solid var(${semanticVariable(`fill.border.${family}`)})`
                            : undefined,
                        }}
                      >
                        Recorded execution
                      </span>
                    </td>
                    <td>
                      {ratios
                        .map((ratio) => `${ratio.toFixed(2)}:1`)
                        .join(" / ")}{" "}
                      ·{" "}
                      {ratios.every((ratio) => ratio >= 4.5) ? "Pass" : "Fail"}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </details>
      <details>
        <summary>Semantic aliases</summary>
        <table>
          <caption>Use these names in components</caption>
          <thead>
            <tr>
              <th scope="col">Semantic token</th>
              <th scope="col">Palette role</th>
              <th scope="col">Resolved sRGB value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(semanticColors).map(([name, reference]) => (
              <tr key={name}>
                <th scope="row">
                  <code>{semanticVariable(name)}</code>
                </th>
                <td>{reference}</td>
                <td>{resolveColor(theme, name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details open>
        <summary>Foreground/background pairings and contrast</summary>
        <p>
          Text targets 4.5:1; focus and essential control-boundary targets 3:1.
          Subtle decorative borders are not tested as essential boundaries.
          Ratios cover these pairs only, not every combination in the palette.
        </p>
        <table>
          <caption>Intended semantic pairings</caption>
          <thead>
            <tr>
              <th scope="col">Use</th>
              <th scope="col">Foreground / background</th>
              <th scope="col">Example</th>
              <th scope="col">sRGB / wide gamut ratio</th>
              <th scope="col">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {contrastPairs.map((pair) => {
              const ratios = ["srgb", "p3"].map((gamut) => {
                let background = new Color(
                  resolveColor(theme, pair.background, gamut),
                );
                if (pair.underlay) {
                  const overlay = background.to("srgb");
                  const base = new Color(
                    resolveColor(theme, pair.underlay, gamut),
                  ).to("srgb");
                  background = new Color(
                    "srgb",
                    overlay.coords.map(
                      (channel, index) =>
                        channel * overlay.alpha +
                        base.coords[index] * (1 - overlay.alpha),
                    ),
                  );
                }
                return Color.contrastWCAG21(
                  new Color(resolveColor(theme, pair.foreground, gamut)),
                  background,
                );
              });
              return (
                <tr
                  key={`${pair.foreground}/${pair.background}/${pair.underlay ?? "opaque"}`}
                >
                  <th scope="row">{pair.purpose}</th>
                  <td>
                    <code>{pair.foreground}</code>
                    <br />
                    <code>{pair.background}</code>
                    {pair.underlay && (
                      <>
                        <br />
                        over <code>{pair.underlay}</code>
                      </>
                    )}
                  </td>
                  <td
                    style={
                      pair.underlay
                        ? {
                            backgroundColor: `var(${semanticVariable(pair.underlay)})`,
                          }
                        : undefined
                    }
                  >
                    {pair.minimum === 4.5 ? (
                      <span
                        className="even-color-grid__pair"
                        style={{
                          color: `var(${semanticVariable(pair.foreground)})`,
                          backgroundColor: `var(${semanticVariable(pair.background)})`,
                        }}
                      >
                        Recorded execution
                      </span>
                    ) : (
                      <span
                        className="even-color-grid__boundary"
                        style={{
                          backgroundColor: `var(${semanticVariable(pair.background)})`,
                          borderColor: `var(${semanticVariable(pair.foreground)})`,
                        }}
                      >
                        Boundary example
                      </span>
                    )}
                  </td>
                  <td>
                    {ratios.map((ratio) => `${ratio.toFixed(2)}:1`).join(" / ")}
                  </td>
                  <td>
                    {pair.minimum}:1 ·{" "}
                    {ratios.every((ratio) => ratio >= pair.minimum)
                      ? "Pass"
                      : "Fail"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}
