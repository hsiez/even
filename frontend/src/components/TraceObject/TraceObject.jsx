import React from "react";
import { describeSpan } from "../../traces/traceModel";
import { classes } from "../presentation";
import "../components.css";

// Presentation only: the tree owns selection, focus and expansion; the host
// supplies the original span without modifying it.
export function TraceObject({
  span,
  category,
  categoryAppearance = "plain",
  className,
  ...props
}) {
  const description = describeSpan(span);
  const step = span.name === "agent.step";
  return (
    <span
      {...props}
      className={classes("even-trace-object", className)}
      data-category={step ? "Step" : (category ?? description.kind)}
      data-category-appearance={categoryAppearance}
    >
      {!step && (
        <span className="even-trace-object-category">
          {category ?? description.kind}
        </span>
      )}{" "}
      <span className="even-trace-path-name">{description.label}</span>
    </span>
  );
}
