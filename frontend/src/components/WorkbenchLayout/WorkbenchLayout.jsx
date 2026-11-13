import { classes } from "../presentation";
import React from "react";
export function WorkbenchLayout({ navigation, inspector, children, ...props }) {
  return (
    <div {...props} className={classes("even-workbench", props.className)}>
      {navigation}
      <main aria-label="Trace workbench">{children}</main>
      {inspector}
    </div>
  );
}
