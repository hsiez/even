export const traceColumns = [
  {
    id: "startedAt",
    label: "Started",
    preferredRem: 18,
    minRem: 10,
    sortable: true,
  },
  {
    id: "durationMs",
    label: "Duration",
    preferredRem: 8,
    minRem: 7,
    sortable: true,
  },
  { id: "agent", label: "Agent", preferredRem: 8, minRem: 6 },
  { id: "operation", label: "Operation", preferredRem: 20, minRem: 8 },
  { id: "calls", label: "Calls", preferredRem: 10, minRem: 7 },
  { id: "outcome", label: "Outcome", minRem: 6 },
];

export function rootFontSize() {
  return typeof document === "undefined"
    ? 16
    : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export function columnLimits(column) {
  const root = rootFontSize();
  return { min: column.minRem * root, max: 96 * root };
}

export function normalizeColumnWidths(widths) {
  return Object.fromEntries(
    traceColumns
      .filter((column) => column.preferredRem !== undefined)
      .flatMap((column) => {
        const width = widths?.[column.id];
        if (typeof width !== "number" || !Number.isFinite(width)) return [];
        const { min, max } = columnLimits(column);
        return [[column.id, Math.min(max, Math.max(min, width))]];
      }),
  );
}
