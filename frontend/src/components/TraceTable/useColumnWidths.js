import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  traceColumns,
  normalizeColumnWidths,
  columnLimits,
  rootFontSize,
} from "./columns";

function createWidthStore(defaultWidths) {
  let widths = normalizeColumnWidths(defaultWidths);
  const listeners = new Set();
  return {
    getSnapshot: () => widths,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resize(column, width) {
      const next = normalizeColumnWidths({ ...widths, [column.id]: width });
      if (
        Object.keys(next).length === Object.keys(widths).length &&
        Object.entries(next).every(([id, value]) => widths[id] === value)
      )
        return;
      widths = next;
      for (const listener of [...listeners]) listener();
      return next;
    },
  };
}

export function useColumnWidths({
  tableRef,
  columnWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
}) {
  const [store] = useState(() => createWidthStore(defaultColumnWidths));
  const internal = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const widths = normalizeColumnWidths(
    columnWidths === undefined ? internal : columnWidths,
  );
  const [rootSize, setRootSize] = useState(rootFontSize);
  useLayoutEffect(() => {
    const headers = [
      ...tableRef.current.querySelectorAll("thead th[data-column-id]"),
    ];

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
    const next =
      columnWidths === undefined
        ? store.resize(column, width)
        : normalizeColumnWidths({ ...widths, [column.id]: width });
    if (
      !next ||
      (columnWidths !== undefined && next[column.id] === widths[column.id])
    )
      return;
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
