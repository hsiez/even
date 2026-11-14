import React from "react";
import { Button } from "../Button/Button";
import { classes } from "../presentation";
export function IconButton({ label, children, className, ...props }) {
  return (
    <Button
      {...props}
      className={classes("even-icon-button", className)}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
    </Button>
  );
}
