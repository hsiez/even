import React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { classes } from "../presentation";

export function Button({
  pending = false,
  disabled = false,
  variant = "secondary",
  size = "default",
  className,
  ...props
}) {
  return (
    <BaseButton
      type="button"
      {...props}
      className={classes("even-button", className)}
      data-variant={variant}
      data-size={size}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    />
  );
}
