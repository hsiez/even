import React, { useState } from "react";
import { motionDecisions, motionOptions } from "../motion";
import { Button } from "../../components/Button/Button";
import "../ColorGrid/ColorGrid.css";
import "./MotionGrid.css";

export function MotionGrid({
  theme = "light",
  kind = "decisions",
  reduced = false,
}) {
  const [active, setActive] = useState({});
  const largeOnly = kind === "large";
  const rows =
    kind === "options"
      ? motionOptions
      : motionDecisions.filter(
          (token) => !largeOnly || token.name.endsWith("-large"),
        );
  const previews = [
    "enter",
    "exit",
    "move",
    "feedback",
    "enter-large",
    "exit-large",
    "move-large",
  ].filter((purpose) => !largeOnly || purpose.endsWith("-large"));
  const title = largeOnly ? "Large-area motion decisions" : `Motion ${kind}`;
  return (
    <section
      className="even-color-grid even-motion-grid"
      data-even-theme={theme}
      data-reduced={reduced || undefined}
      aria-label={`Motion tokens (${theme}, ${kind})`}
    >
      <h2>{title}</h2>
      <p>
        Short, purposeful transitions. Compare entry, exit, movement and
        feedback below. Keyboard navigation and scroll tracking stay immediate.
        Reduced motion removes travel; optional meaningful fades can remain.
        Large surfaces use a longer settling time: 350ms entry/movement and
        300ms exit, with the same easing families as small controls.
      </p>
      {kind !== "options" && (
        <div className="even-motion-grid__previews">
          {previews.map((purpose) => (
            <div
              key={purpose}
              className="even-motion-grid__preview"
              data-large={purpose.endsWith("-large") || undefined}
              style={{
                "--preview-duration": `var(--even-motion-duration-${purpose})`,
                "--preview-easing": `var(--even-motion-easing-${purpose})`,
              }}
            >
              <Button
                aria-pressed={!!active[purpose]}
                onClick={() =>
                  setActive((current) => ({
                    ...current,
                    [purpose]: !current[purpose],
                  }))
                }
              >
                Preview {purpose}
              </Button>
              <div className="even-motion-grid__lane" aria-hidden="true">
                <span
                  className="even-motion-grid__sample"
                  data-purpose={purpose.replace("-large", "")}
                  data-active={!!active[purpose]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <table>
        <caption>{title}, resolved values and purpose</caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">
              {kind === "options" ? "Type" : "Option reference"}
            </th>
            <th scope="col">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((token) => (
            <tr key={token.variable}>
              <th scope="row">
                <code>{token.variable}</code>
              </th>
              <td>
                <code>{token.value}</code>
              </td>
              <td>
                <code>{token.reference ?? token.type}</code>
              </td>
              <td>{token.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
