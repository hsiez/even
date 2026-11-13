import React from "react";
import "../components.css";
export function ViewExecutionAction({
  traces = [],
  pending = false,
  hrefForTrace,
}) {
  if (pending)
    return <span role="status">Waiting for recorded execution…</span>;
  if (!traces.length) return <span>No associated trace available.</span>;
  return (
    <nav className="even-execution-links" aria-label="Associated executions">
      {traces.map((trace, index) => (
        <a key={trace.traceId} href={hrefForTrace(trace.traceId)}>
          {traces.length === 1
            ? "View execution"
            : `View execution ${index + 1}`}
        </a>
      ))}
    </nav>
  );
}
