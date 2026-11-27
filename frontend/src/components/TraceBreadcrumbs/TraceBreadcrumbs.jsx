import React from "react";
import { Button } from "../Button/Button";
import { classes } from "../presentation";
import { ParentExecutionIcon } from "../icons";

export function TraceBreadcrumbs({
  items = [],
  onNavigate,
  onSelectCurrent,
  showBack = false,
  className,
  label = "Agent execution ancestry",
  ...props
}) {
  return (
    <nav
      {...props}
      className={classes("even-trace-breadcrumbs", className)}
      aria-label={label}
    >
      <ol>
        {items.map((item, index) => (
          <li key={item.id}>
            {index > 0 && (
              <span
                className="even-trace-breadcrumb-separator"
                aria-hidden="true"
              >
                /
              </span>
            )}
            {index === items.length - 1 ? (
              onSelectCurrent ? (
                <Button
                  variant="ghost"
                  size="compact"
                  aria-current="location"
                  onClick={() => onSelectCurrent(item.id)}
                >
                  {item.label}
                </Button>
              ) : (
                <span aria-current="location">{item.label}</span>
              )
            ) : (
              <Button
                variant="ghost"
                size="compact"
                onClick={() => onNavigate?.(item.id)}
                disabled={!onNavigate}
              >
                {item.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
      {showBack && items.length > 1 && (
        <Button
          className="even-trace-back"
          variant="ghost"
          size="compact"
          disabled={!onNavigate}
          onClick={() => onNavigate?.(items.at(-2).id)}
        >
          <ParentExecutionIcon aria-hidden="true" focusable="false" />
          Back to {items.at(-2).label}
        </Button>
      )}
    </nav>
  );
}
