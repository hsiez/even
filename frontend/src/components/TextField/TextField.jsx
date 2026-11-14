import React from "react";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { classes } from "../presentation";

export function TextField({ label, description, error, className, ...props }) {
  return (
    <Field.Root
      className="even-field"
      invalid={!!error}
      disabled={props.disabled}
    >
      <Field.Label className="even-label">{label}</Field.Label>
      <Input {...props} className={classes("even-input", className)} />
      {description && (
        <Field.Description className="even-help">
          {description}
        </Field.Description>
      )}
      {error && (
        <Field.Error className="even-field-error" match>
          {error}
        </Field.Error>
      )}
    </Field.Root>
  );
}
