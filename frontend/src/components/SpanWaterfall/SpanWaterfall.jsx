import "../components.css";
import React from "react";
import { createContext, useContext, useId } from "react";
import { useControllable } from "../state";
import { Duration } from "../Duration/Duration";
const Context = createContext(null);
function useWaterfall() {
  const value = useContext(Context);
  if (!value) throw new Error("SpanWaterfall parts require <SpanWaterfall>.");
  return value;
}
export function spanTiming(span, origin) {
  try {
    if (span.startTimeNs == null || span.endTimeNs == null) return undefined;
    const start = BigInt(span.startTimeNs);
    const end = BigInt(span.endTimeNs);
    if (end < start) return undefined;
    return {
      durationMs: Number(end - start) / 1e6,
      offsetMs: origin == null ? 0 : Number(start - BigInt(origin)) / 1e6,
    };
  } catch {
    return undefined;
  }
}
function Root({
  spans = [],
  selectedSpanId,
  defaultSelectedSpanId,
  onSelectSpan,
  expandedSpanIds,
  defaultExpandedSpanIds = [],
  onExpandedChange,
  children,
}) {
  const [selected, select] = useControllable(
    selectedSpanId,
    defaultSelectedSpanId,
    onSelectSpan,
  );
  const [expanded, expand] = useControllable(
    expandedSpanIds,
    defaultExpandedSpanIds,
    onExpandedChange,
  );
  const id = useId();
  return (
    <Context.Provider value={{ spans, selected, select, expanded, expand, id }}>
      {children}
    </Context.Provider>
  );
}
// Normalize malformed parentage into a forest so missing parents and cycles cannot hide spans.
export function spanForest(spans) {
  const nodes = new Map(
    spans.map((span) => [span.spanId, { span, children: [] }]),
  );
  const roots = [];
  for (const node of nodes.values()) {
    let parent = nodes.get(node.span.parentSpanId);
    const visited = new Set([node.span.spanId]);
    let ancestor = parent;
    while (ancestor) {
      if (visited.has(ancestor.span.spanId)) {
        parent = undefined;
        break;
      }
      visited.add(ancestor.span.spanId);
      ancestor = nodes.get(ancestor.span.parentSpanId);
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
function Tree({ label = "Execution spans" }) {
  const { spans, selected, select, expanded, expand, id } = useWaterfall();
  const roots = spanForest(spans);
  const visible = [];
  function collect(nodes) {
    for (const node of nodes) {
      visible.push(node);
      if (expanded.includes(node.span.spanId)) collect(node.children);
    }
  }
  collect(roots);
  const active = visible.some((node) => node.span.spanId === selected)
    ? selected
    : visible[0]?.span.spanId;
  function toggle(spanId, open) {
    expand((previous) =>
      open
        ? [...new Set([...previous, spanId])]
        : previous.filter((id) => id !== spanId),
    );
  }
  // Explicit ownership keeps the accessible child group attached to its
  // parent without including descendant operation text in the parent label.
  function renderNodes(nodes) {
    return nodes.map(({ span, children }) => {
      const isExpanded = expanded.includes(span.spanId);
      const key = encodeURIComponent(span.spanId);
      return (
        <li key={span.spanId} role="none">
          <div
            role="treeitem"
            id={`${id}-${key}`}
            data-span-id={span.spanId}
            tabIndex={active === span.spanId ? 0 : -1}
            aria-labelledby={`${id}-${key}-label`}
            aria-selected={selected === span.spanId}
            aria-expanded={children.length ? isExpanded : undefined}
            aria-owns={
              children.length && isExpanded ? `${id}-${key}-group` : undefined
            }
            onClick={(event) => {
              if (
                event.target.closest('[role="treeitem"]') !==
                event.currentTarget
              )
                return;
              event.currentTarget.focus();
              select(span.spanId);
            }}
          >
            {children.length > 0 && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${span.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  event.currentTarget.closest('[role="treeitem"]').focus();
                  toggle(span.spanId, !isExpanded);
                }}
              >
                {isExpanded ? "−" : "+"}
              </button>
            )}
            <span id={`${id}-${key}-label`}>{span.name}</span>
          </div>
          {children.length > 0 && isExpanded && (
            <ul role="group" id={`${id}-${key}-group`}>
              {renderNodes(children)}
            </ul>
          )}
        </li>
      );
    });
  }
  return (
    <ul
      className="even-span-tree"
      role="tree"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.target.getAttribute("role") !== "treeitem") return;
        const items = [
          ...event.currentTarget.querySelectorAll('[role="treeitem"]'),
        ];
        const index = items.indexOf(event.target);
        const node = visible[index];
        if (!node) return;
        const spanId = node.span.spanId;
        let target;
        if (event.key === "ArrowDown")
          target = items[Math.min(index + 1, items.length - 1)];
        if (event.key === "ArrowUp") target = items[Math.max(index - 1, 0)];
        if (event.key === "Home") target = items[0];
        if (event.key === "End") target = items.at(-1);
        if (event.key === "ArrowRight" && node.children.length) {
          if (!expanded.includes(spanId)) toggle(spanId, true);
          else target = items[index + 1];
        }
        if (event.key === "ArrowLeft") {
          if (node.children.length && expanded.includes(spanId))
            toggle(spanId, false);
          else
            target = items.find(
              (item) => item.dataset.spanId === node.span.parentSpanId,
            );
        }
        if (event.key === "Enter" || event.key === " ") select(spanId);
        if (target) {
          items.forEach((item) => {
            item.tabIndex = item === target ? 0 : -1;
          });
          target.focus();
        }
        if (
          target ||
          ["ArrowRight", "ArrowLeft", "Enter", " "].includes(event.key)
        )
          event.preventDefault();
      }}
    >
      {renderNodes(roots)}
    </ul>
  );
}
function Timeline() {
  const { spans, selected, select } = useWaterfall();
  const starts = spans
    .filter((span) => spanTiming(span))
    .map((span) => BigInt(span.startTimeNs));
  const origin = starts.length
    ? starts.reduce((a, b) => (a < b ? a : b))
    : undefined;
  return (
    <div
      className="even-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Span timing"
    >
      <table className="even-table">
        <caption>Span timing relative to trace start</caption>
        <thead>
          <tr>
            <th scope="col">Operation</th>
            <th scope="col">Start offset</th>
            <th scope="col">Duration</th>
          </tr>
        </thead>
        <tbody>
          {spans.map((span) => {
            const timing = spanTiming(span, origin);
            return (
              <tr key={span.spanId}>
                <td>
                  <button
                    className="even-button"
                    data-variant="ghost"
                    data-size="compact"
                    type="button"
                    aria-pressed={selected === span.spanId}
                    onClick={() => select(span.spanId)}
                  >
                    {span.name}
                  </button>
                </td>
                <td>
                  <Duration milliseconds={timing?.offsetMs} />
                </td>
                <td>
                  <Duration milliseconds={timing?.durationMs} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export const SpanWaterfall = Object.assign(Root, { Tree, Timeline });
