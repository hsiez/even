import "../components.css";
import React from "react";
export function TraceStatus({ errorCount, complete = false }) {
  const status =
    errorCount > 0
      ? "Errors recorded"
      : complete
        ? "Completed without recorded errors"
        : "Completion unknown";
  return (
    <span
      className="even-trace-status"
      data-state={errorCount > 0 ? "error" : complete ? "complete" : "unknown"}
    >
      {status}
    </span>
  );
}
