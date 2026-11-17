import React, { useId, useRef } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { classes } from "../presentation";

// A product composition: Base UI owns popup state, active items and keyboard input.
// Suggestions and query semantics belong to the caller.
export function TraceSearch({
  value = "",
  onValueChange,
  onCommit,
  suggestions = [],
  error,
  label = "Search traces",
  disabled = false,
  defaultOpen = false,
  className,
  style,
  inputProps = {},
}) {
  const id = useId();
  const actions = useRef(null);
  return (
    <form
      className={classes("even-trace-search even-field", className)}
      style={style}
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        onCommit?.(value);
        actions.current?.close();
      }}
    >
      <Autocomplete.Root
        defaultOpen={defaultOpen}
        actionsRef={actions}
        value={value}
        onValueChange={(next, details) => {
          onValueChange(next, details);
          if (!details.isCanceled && details.reason === "item-press") {
            onCommit?.(next);
          }
        }}
        items={suggestions}
        itemToStringValue={(item) => item.query}
        mode="none"
        openOnInputClick
        disabled={disabled}
      >
        <div className="even-trace-search-input">
          <Autocomplete.Input
            {...inputProps}
            id={id}
            className={classes("even-input", inputProps.className)}
            placeholder={inputProps.placeholder ?? "Search traces..."}
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={
              [error && `${id}-error`, inputProps["aria-describedby"]]
                .filter(Boolean)
                .join(" ") || undefined
            }
            maxLength={2000}
          />
          <Autocomplete.Clear
            className="even-button"
            data-variant="ghost"
            aria-label="Clear search"
          >
            ×
          </Autocomplete.Clear>
        </div>
        <Autocomplete.Portal className="even-overlay-portal">
          <Autocomplete.Positioner
            className="even-positioner"
            sideOffset={4}
            align="start"
          >
            <Autocomplete.Popup className="even-popup even-trace-search-popup">
              <p className="even-trace-search-heading">
                {value ? "Suggestions" : "Explore your traces"}
              </p>
              <Autocomplete.List aria-label="Search suggestions">
                {(item) => (
                  <Autocomplete.Item
                    key={item.query}
                    value={item}
                    className="even-trace-search-item"
                  >
                    <code>{item.query}</code> <span>{item.description}</span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
              <Autocomplete.Empty className="even-help">
                Keep typing, or press Enter to search.
              </Autocomplete.Empty>
              <p className="even-trace-search-footer">
                Combine filters with spaces · quote phrases
              </p>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      <button type="submit" hidden>
        Search
      </button>
      {error && (
        <p className="even-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
