import React from "react";
import { dimensionOptions, dimensionDecisions } from "../dimensions";
import "../generated/tokens.css";
import "../ColorGrid/ColorGrid.css";
import "./DimensionGrid.css";

export function DimensionGrid({ theme = "light", kind = "options" }) {
  const options = kind === "options";
  const rows = options
    ? dimensionOptions
    : dimensionDecisions.filter((token) => token.category === kind);
  const title = options
    ? "Dimension options"
    : kind === "space"
      ? "Spacing decisions"
      : "Sizing decisions";
  return (
    <section
      className="even-color-grid even-dimension-grid"
      data-even-theme={theme}
      aria-label={title}
    >
      <h2>{title}</h2>
      <p>
        One shared scale, mainly 4px increments. Fine adjustment: 2px. Larger
        steps spread apart. Values use rem; pixel equivalents below assume a
        16px root, without setting that root size.
      </p>
      {!options && (
        <p>
          These decisions reference options. Control sizes are minimum heights;
          panel sizes are preferred widths, not fixed layout requirements.
        </p>
      )}
      <table>
        <caption>{title} and examples</caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">{options ? "Reference px" : "Option reference"}</th>
            <th scope="col">Example length</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((token) => (
            <tr key={token.variable}>
              <th scope="row">
                <code>{token.variable}</code>
              </th>
              <td>{token.value}</td>
              <td>{options ? `${Number(token.key)}px` : token.reference}</td>
              <td>
                <span
                  className="even-dimension-grid__bar"
                  aria-hidden="true"
                  style={{ inlineSize: `min(100%, var(${token.variable}))` }}
                />
                {token.description && <small>{token.description}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
