import { classes } from "../presentation";
import React from "react";
export function Sidebar({
  children,
  label = "Workbench navigation",
  ...props
}) {
  return (
    <nav
      {...props}
      className={classes("even-sidebar", props.className)}
      aria-label={label}
    >
      {children}
    </nav>
  );
}
