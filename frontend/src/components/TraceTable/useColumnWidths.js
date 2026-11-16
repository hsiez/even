import { useLayoutEffect, useRef, useState } from "react";
import {
  traceColumns,
  normalizeColumnWidths,
  columnLimits,
  rootFontSize,
} from "./columns";

export function useColumnWidths({
  tableRef,
  columnWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
}) {
  const [internal, setInternal] = useState(() =>
    normalizeColumnWidths(defaultColumnWidths),
  );
  const widths = normalizeColumnWidths(
    columnWidths === undefined ? internal : columnWidths,
  );
  const latest = useRef(widths);
  useLayoutEffect(() => {
    latest.current = widths;
  });
  const [rootSize, setRootSize] = useState(rootFontSize);
  useLayoutEffect(() => {
    const headers = [
      ...tableRef.current.querySelectorAll("thead th[data-column-id]"),
    ];
    // Widths are fixed by colgroup. Observe layout only to refresh rem-based
    // limits/announcements when the user's root text size changes.
    function measure() {
      setRootSize(rootFontSize());
    }
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    headers.forEach((header) => observer?.observe(header));
    return () => observer?.disconnect();
  }, [tableRef]);

  function resize(column, width) {
    const next = normalizeColumnWidths({
      ...latest.current,
      [column.id]: width,
    });
    if (next[column.id] === latest.current[column.id]) return;
    if (columnWidths === undefined) {
      latest.current = next;
      setInternal(next);
    }
    onColumnWidthsChange?.(next);
  }

  const columns = traceColumns.map((column) => {
    const { min, max } = columnLimits(column);
    return {
      ...column,
      min,
      max,
      width:
        widths[column.id] ?? (column.preferredRem ?? column.minRem) * rootSize,
      cssWidth:
        column.preferredRem === undefined
          ? undefined
          : widths[column.id] === undefined
            ? `${column.preferredRem}rem`
            : `${widths[column.id]}px`,
    };
  });
  const minimumTableWidth = [
    ...columns.slice(0, -1).map((column) => column.cssWidth),
    `${traceColumns.at(-1).minRem}rem`,
  ].join(" + ");
  return {
    columns,
    resize,
    tableWidth: `max(100%, calc(${minimumTableWidth}))`,
  };
}
