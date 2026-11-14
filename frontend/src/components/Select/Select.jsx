import React, { useId } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { classes } from "../presentation";

// Convenience composition; Base UI owns selection, typeahead, focus and dismissal.
export function Select({
  label,
  options,
  onValueChange,
  id: suppliedId,
  className,
  style,
  ...props
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="even-field">
      <label className="even-label" id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <BaseSelect.Root
        {...props}
        items={options}
        onValueChange={(value) => onValueChange?.(value)}
      >
        <BaseSelect.Trigger
          id={id}
          aria-labelledby={`${id}-label`}
          className={classes("even-button even-select-trigger", className)}
          style={style}
        >
          <BaseSelect.Value />
          <BaseSelect.Icon aria-hidden="true">▾</BaseSelect.Icon>
        </BaseSelect.Trigger>
        <BaseSelect.Portal className="even-overlay-portal">
          <BaseSelect.Positioner className="even-positioner">
            <BaseSelect.Popup className="even-popup even-select-popup">
              <BaseSelect.List>
                {options.map((option) => (
                  <BaseSelect.Item
                    className="even-menu-item"
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                    <BaseSelect.ItemIndicator aria-hidden="true">
                      ✓
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    </div>
  );
}
