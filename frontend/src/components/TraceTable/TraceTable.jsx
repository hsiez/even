import "../components.css";
import React, { useId, useRef } from "react";
import { Timestamp } from "../Timestamp/Timestamp";
import { Duration } from "../Duration/Duration";
import { TraceStatus } from "../TraceStatus/TraceStatus";
import { Button } from "../Button/Button";
import { traceTimeline } from "./timeline";
import { useColumnWidths } from "./useColumnWidths";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { CellOverflow } from "./CellOverflow";
export function TraceTable({
  traces,
  reloads = [],
  selectedTraceId,
  selectedOperationRef,
  scrollRef,
  onScroll,
  onSelectTrace,
  renderOperationDetail,
  sort = { key: "startedAt", direction: "descending" },
  onSortChange,
  columnWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
  "aria-label": regionLabel = "Recorded trace results",
}) {
  const tableId = useId();
  const tableRef = useRef(null);
  const { columns, resize, tableWidth } = useColumnWidths({
    tableRef,
    columnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
  });
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="even-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={regionLabel}
    >
      <table
        ref={tableRef}
        id={tableId}
        className="even-table even-trace-table"
        style={{ width: tableWidth }}
      >
        <caption>
          Recorded traces
          {reloads.length > 0 &&
            sort.key !== "startedAt" &&
            " · Reload markers appear when sorted by Started"}
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.cssWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.id}
                data-column-id={column.id}
                data-resizable={index < columns.length - 1 || undefined}
                scope="col"
                aria-labelledby={`${tableId}-${column.id}-label`}
                aria-sort={
                  column.sortable && sort.key === column.id
                    ? sort.direction
                    : undefined
                }
              >
                <span
                  className="even-trace-header-content"
                  id={`${tableId}-${column.id}-label`}
                >
                  {column.sortable && onSortChange ? (
                    <Button
                      className="even-trace-text-action"
                      variant="ghost"
                      size="compact"
                      onClick={() =>
                        onSortChange({
                          key: column.id,
                          direction:
                            sort.key === column.id &&
                            sort.direction === "descending"
                              ? "ascending"
                              : "descending",
                        })
                      }
                    >
                      <CellOverflow>{column.label}</CellOverflow>
                    </Button>
                  ) : (
                    column.label
                  )}
                </span>
                {index < columns.length - 1 && (
                  <ColumnResizeHandle
                    column={column}
                    tableId={tableId}
                    onResize={(width) => resize(column, width)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {traceTimeline(traces, reloads, sort).map((row) => {
            if (row.kind === "reload")
              return (
                <tr
                  key={`reload-${row.reload.id}`}
                  data-row-kind="reload"
                  data-stripe={row.stripe}
                  className="even-trace-reload"
                >
                  <td colSpan={6}>
                    <div className="even-trace-reload-content">
                      <span>
                        <strong>Agent reloaded</strong>
                        {" · "}
                        <Timestamp value={row.reload.observedAt} />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            const { trace, stripe } = row;
            return (
              <tr
                key={`trace-${trace.traceId}`}
                data-row-kind="trace"
                data-stripe={stripe}
                data-selected={selectedTraceId === trace.traceId || undefined}
              >
                <td>
                  <CellOverflow>
                    <Timestamp value={trace.startedAt} />
                  </CellOverflow>
                </td>
                <td>
                  <CellOverflow>
                    <Duration milliseconds={trace.durationMs} />
                  </CellOverflow>
                </td>
                <td data-column-id="agent">
                  <CellOverflow>
                    {trace.agentNames?.join(", ") || "Unknown agent"}
                  </CellOverflow>
                </td>
                <td className="even-trace-operation" data-column-id="operation">
                  <Button
                    ref={
                      selectedTraceId === trace.traceId
                        ? selectedOperationRef
                        : undefined
                    }
                    className="even-trace-operation-action"
                    variant="ghost"
                    size="compact"
                    data-has-detail={!!renderOperationDetail || undefined}
                    aria-pressed={selectedTraceId === trace.traceId}
                    onClick={() => onSelectTrace(trace.traceId)}
                  >
                    <CellOverflow>{trace.label ?? trace.traceId}</CellOverflow>
                    {renderOperationDetail && (
                      <span
                        className="even-trace-operation-detail"
                        id={`${tableId}-${trace.traceId}-detail`}
                      >
                        {renderOperationDetail(trace)}
                      </span>
                    )}
                  </Button>
                </td>
                <td>
                  <CellOverflow>
                    {trace.modelCalls ?? "Unknown"} model ·{" "}
                    {trace.toolCalls ?? "Unknown"} tool
                  </CellOverflow>
                </td>
                <td className="even-trace-outcome">
                  <CellOverflow>
                    <TraceStatus
                      errorCount={trace.errorSpanCount}
                      complete={trace.complete}
                    />
                  </CellOverflow>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
