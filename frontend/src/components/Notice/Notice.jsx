import { classes } from "../presentation";
import React from "react";
export function Notice({ children, urgent = false, action, ...props }) {
  return (
    <div
      {...props}
      className={classes("even-notice", props.className)}
      role={urgent ? "alert" : "status"}
    >
      {children}
      {action}
    </div>
  );
}
