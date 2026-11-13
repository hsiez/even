import React from "react";
import Color from "colorjs.io";
import {
  palettes,
  wideGamutPalettes,
  themes,
  scaleNames,
  stepRoles,
  semanticColors,
  contrastPairs,
  paletteVariable,
  semanticVariable,
  resolveColor,
  source,
} from "../colors";
import "../generated/tokens.css";
import "./ColorGrid.css";

export function ColorGrid({ theme = "light" }) {
  if (!themes.includes(theme))
    throw new Error("ColorGrid theme must be light or dark.");
  return (
    <section
      className="even-color-grid"
      data-even-theme={theme}
      aria-label={`${theme} color tokens`}
    >
      <header>
        <h2>{theme === "light" ? "Light" : "Dark"} color tokens</h2>
        <p>
          Geist palette snapshot · {source.retrieved}. Numbered steps describe
          jobs, not a simple light-to-dark ramp.
        </p>
        <p>
          Swatches use wide-gamut overrides on supported displays. Values below
          each swatch are the sRGB fallback, followed by the optional wide-gamut
          value.
        </p>
        <a href={source.url}>Source: Geist colors</a>
      </header>
      <div
        className="even-color-grid__scroll"
        role="region"
        aria-label={`${theme} palette grid`}
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
              <tr key={family}>
                <th scope="row">{family}</th>
                {Array.from({ length: 10 }, (_, index) => {
                  const step = index + 1;
                  const value = palettes[theme][family][step];
                  const wide = wideGamutPalettes[theme][family]?.[step];
                  return (
                    <td key={step}>
                      {value ? (
                        <>
                          <div
                            className="even-color-grid__swatch"
                            aria-hidden="true"
                            style={{
                              backgroundColor: `var(${paletteVariable(family, step)})`,
                            }}
                          />
                          <code>{paletteVariable(family, step)}</code>
                          <small>{value}</small>
                          {wide && <small>{wide}</small>}
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
        ten-step component scales. Gray-alpha swatches are composited over the
        page surface; their appearance depends on the surface beneath them.
      </p>
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
              const ratios = ["srgb", "p3"].map((gamut) =>
                Color.contrastWCAG21(
                  new Color(resolveColor(theme, pair.foreground, gamut)),
                  new Color(resolveColor(theme, pair.background, gamut)),
                ),
              );
              return (
                <tr key={`${pair.foreground}/${pair.background}`}>
                  <th scope="row">{pair.purpose}</th>
                  <td>
                    <code>{pair.foreground}</code>
                    <br />
                    <code>{pair.background}</code>
                  </td>
                  <td>
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
