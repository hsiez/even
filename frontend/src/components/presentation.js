import React from "react";
import "./components.css";

// Base UI accepts either a class string or a callback receiving primitive state.
// Preserve that API (and ref/render/event props) when adding our presentation.
export function classes(base, supplied) {
  if (typeof supplied === "function")
    return (state) => [base, supplied(state)].filter(Boolean).join(" ");
  return [base, supplied].filter(Boolean).join(" ");
}

export function styledPart(Component, base) {
  return function StyledPart({ className, ...props }) {
    return React.createElement(Component, {
      ...props,
      className: classes(base, className),
    });
  };
}
