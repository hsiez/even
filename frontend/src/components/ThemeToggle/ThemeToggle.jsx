import React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { classes } from "../presentation";
import { LightThemeIcon, DarkThemeIcon } from "../icons";

// The host owns the document theme. Base UI owns selection and keyboard input.
export function ThemeToggle({ className, ...props }) {
  return (
    <RadioGroup
      aria-label="Color theme"
      {...props}
      className={classes("even-theme-toggle", className)}
    >
      <Radio.Root
        className="even-theme-option"
        value="light"
        aria-label="Light theme"
        title="Light theme"
      >
        <LightThemeIcon aria-hidden="true" focusable="false" />
      </Radio.Root>
      <Radio.Root
        className="even-theme-option"
        value="dark"
        aria-label="Dark theme"
        title="Dark theme"
      >
        <DarkThemeIcon aria-hidden="true" focusable="false" />
      </Radio.Root>
    </RadioGroup>
  );
}
