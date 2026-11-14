import "../components.css";
import React from "react";
import { Timestamp } from "../Timestamp/Timestamp";
import { Duration } from "../Duration/Duration";
import { TraceStatus } from "../TraceStatus/TraceStatus";
import { Button } from "../Button/Button";
export function TraceTable({
  traces,
  selectedTraceId,
  onSelectTrace,
  sort = { key: "startedAt", direction: "descending" },
  onSortChange,
}) {
  const sortable = [
    ["startedAt", "Started"],
    ["durationMs", "Duration"],
  ];
  return (
    <div
      className="even-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Recorded trace results"
    >
      <table className="even-table">
        <caption>Recorded traces</caption>
        <thead>
          <tr>
            {sortable.map(([key, label]) => (
              <th
                key={key}
                scope="col"
                aria-sort={sort.key === key ? sort.direction : undefined}
              >
                {onSortChange ? (
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() =>
                      onSortChange({
                        key,
                        direction:
                          sort.key === key && sort.direction === "descending"
                            ? "ascending"
                            : "descending",
                      })
                    }
                  >
                    {label}
                  </Button>
                ) : (
                  label
                )}
              </th>
            ))}
            <th scope="col">Agent</th>
            <th scope="col">Operation</th>
            <th scope="col">Calls</th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr
              key={trace.traceId}
              data-selected={selectedTraceId === trace.traceId || undefined}
            >
              <td>
                <Timestamp value={trace.startedAt} />
              </td>
              <td>
                <Duration milliseconds={trace.durationMs} />
              </td>
              <td>{trace.agentNames?.join(", ") || "Unknown agent"}</td>
              <td>
                <Button
                  variant="ghost"
                  size="compact"
                  aria-pressed={selectedTraceId === trace.traceId}
                  onClick={() => onSelectTrace(trace.traceId)}
                >
                  {trace.label ?? trace.traceId}
                </Button>
              </td>
              <td>
                {trace.modelCalls ?? "Unknown"} model ·{" "}
                {trace.toolCalls ?? "Unknown"} tool
              </td>
              <td>
                <TraceStatus
                  errorCount={trace.errorSpanCount}
                  complete={trace.complete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
