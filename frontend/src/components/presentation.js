import React from "react";
import "./components.css";

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
