import React from "react";
import { test, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceTable } from "./TraceTable";
import { trace } from "../../test/fixtures";
import { traceHistory, observedReloads } from "../../test/fixtures";

test("exposes the scrolling element and reports its own scroll events", () => {
  const scrollRef = React.createRef();
  const onScroll = vi.fn();
  const { unmount } = render(
    <TraceTable traces={[trace]} scrollRef={scrollRef} onScroll={onScroll} />,
  );
  const viewport = screen.getByRole("region", {
    name: "Recorded trace results",
  });
  expect(scrollRef.current).toBe(viewport);
  fireEvent.scroll(viewport, { target: { scrollLeft: 120 } });
  expect(onScroll).toHaveBeenCalledOnce();
  expect(scrollRef.current.scrollLeft).toBe(120);
  unmount();
  expect(scrollRef.current).toBeNull();
});

test("the selected operation ref follows selection, clears on removal and registers a restored row", () => {
  const selectedOperationRef = React.createRef();
  const second = { traceId: "second", label: "Second trace" };
  const view = (traces, selectedTraceId) => (
    <TraceTable
      traces={traces}
      selectedTraceId={selectedTraceId}
      selectedOperationRef={selectedOperationRef}
      onSelectTrace={() => {}}
    />
  );
  const { rerender, unmount } = render(view([trace, second], trace.traceId));
  const original = screen.getByRole("button", {
    name: "Investigate deployment",
  });
  expect(selectedOperationRef.current).toBe(original);
  rerender(view([trace, second], second.traceId));
  expect(selectedOperationRef.current).toBe(
    screen.getByRole("button", { name: "Second trace" }),
  );
  rerender(view([], second.traceId));
  expect(selectedOperationRef.current).toBeNull();
  rerender(view([trace], trace.traceId));
  expect(selectedOperationRef.current).toBe(
    screen.getByRole("button", { name: "Investigate deployment" }),
  );
  expect(selectedOperationRef.current).not.toBe(original);
  unmount();
  expect(selectedOperationRef.current).toBeNull();
});

test("selects a trace and requests sort changes with semantic headers", async () => {
  const user = userEvent.setup(),
    select = vi.fn(),
    sort = vi.fn();
  render(
    <TraceTable
      traces={[trace, { traceId: "unknown" }]}
      onSelectTrace={select}
      onSortChange={sort}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Investigate deployment" }),
  );
  expect(select).toHaveBeenCalledWith(trace.traceId);
  await user.click(screen.getByRole("button", { name: "Started" }));
  expect(sort).toHaveBeenCalledWith({
    key: "startedAt",
    direction: "ascending",
  });
  expect(screen.getByRole("columnheader", { name: "Started" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  expect(screen.getByText("Completion unknown")).toBeVisible();
});

test("column handles resize with the keyboard, enforce limits and do not sort", async () => {
  const user = userEvent.setup();
  const change = vi.fn(),
    sort = vi.fn();
  const { rerender } = render(
    <TraceTable
      traces={traceHistory}
      onSortChange={sort}
      onColumnWidthsChange={change}
    />,
  );
  expect(screen.getAllByRole("separator")).toHaveLength(5);
  expect(
    screen.queryByRole("separator", { name: "Resize Outcome column" }),
  ).toBeNull();
  const handle = screen.getByRole("separator", {
    name: "Resize Duration column",
  });
  expect(handle).toHaveAttribute("aria-valuenow", "128");
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(handle).toHaveAttribute("aria-valuenow", "136");
  expect(change).toHaveBeenLastCalledWith({ durationMs: 136 });
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  expect(handle).toHaveAttribute("aria-valuenow", "168");
  await user.keyboard("{Home}{ArrowLeft}");
  expect(handle).toHaveAttribute("aria-valuenow", "112");
  await user.keyboard("{End}{ArrowRight}");
  expect(handle).toHaveAttribute("aria-valuenow", "1536");
  expect(sort).not.toHaveBeenCalled();
  rerender(
    <TraceTable
      traces={[...traceHistory].reverse()}
      onColumnWidthsChange={change}
    />,
  );
  expect(handle).toHaveAttribute("aria-valuenow", "1536");
});

test("controlled widths request updates and wait for the owner; empty maps reset defaults", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const view = (widths) => (
    <TraceTable
      traces={[]}
      columnWidths={widths}
      onColumnWidthsChange={change}
    />
  );
  const { rerender } = render(view({ durationMs: 160 }));
  const handle = screen.getByRole("separator", {
    name: "Resize Duration column",
  });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(change).toHaveBeenLastCalledWith({ durationMs: 168 });
  expect(handle).toHaveAttribute("aria-valuenow", "160");
  rerender(view({ durationMs: 168 }));
  expect(handle).toHaveAttribute("aria-valuenow", "168");
  rerender(view({}));
  expect(handle).toHaveAttribute("aria-valuenow", "128");
});

test("default widths are validated and resizing stays local to each table", async () => {
  const user = userEvent.setup();
  render(
    <>
      <TraceTable
        traces={[]}
        defaultColumnWidths={{ durationMs: 1, operation: NaN, calls: Infinity }}
      />
      <TraceTable traces={[]} />
    </>,
  );
  const tables = screen.getAllByRole("table");
  const first = within(tables[0]).getByRole("separator", {
    name: "Resize Duration column",
  });
  const second = within(tables[1]).getByRole("separator", {
    name: "Resize Duration column",
  });
  expect(first).toHaveAttribute("aria-valuenow", "112");
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(first).toHaveAttribute("aria-valuenow", "120");
  expect(second).toHaveAttribute("aria-valuenow", "128");
  expect(
    within(tables[0]).getByRole("separator", {
      name: "Resize Operation column",
    }),
  ).toHaveAttribute("aria-valuenow", "320");
});

test("places reloads by observation time and keeps selection on trace rows", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(
    <TraceTable
      traces={traceHistory}
      reloads={[...observedReloads, ...observedReloads]}
      onSelectTrace={select}
    />,
  );
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(5);
  expect(rows[0]).toHaveTextContent("Investigate deployment");
  expect(rows[1]).toHaveTextContent("Inspect agent configuration");
  expect(rows[2]).toHaveTextContent("Agent reloaded");
  expect(rows[2].querySelector("td")).toHaveAttribute("colspan", "6");
  expect(rows[2].querySelector("button")).toBeNull();
  expect(rows[3]).toHaveTextContent("Read deployment status");
  expect(rows[4]).toHaveTextContent("Inspect permissions");
  await user.click(
    screen.getByRole("button", { name: "Read deployment status", exact: true }),
  );
  expect(select).toHaveBeenCalledWith(traceHistory[2].traceId);
});

test("ascending chronology inserts markers without assigning unknown-time traces a revision", () => {
  render(
    <TraceTable
      traces={[...traceHistory]
        .reverse()
        .concat({ traceId: "unknown", label: "Unknown start" })}
      reloads={[
        ...observedReloads,
        { id: "invalid", type: "agent.reloaded", observedAt: "bad date" },
      ]}
      sort={{ key: "startedAt", direction: "ascending" }}
    />,
  );
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows[0]).toHaveTextContent("Inspect permissions");
  expect(rows[1]).toHaveTextContent("Read deployment status");
  expect(rows[2]).toHaveTextContent("Agent reloaded");
  expect(rows.at(-1)).toHaveTextContent("Unknown start");
});

test("reload-only timelines remain visible and nonchronological sorts omit markers", () => {
  const { rerender } = render(
    <TraceTable traces={[]} reloads={observedReloads} />,
  );
  expect(screen.getByText("Agent reloaded")).toBeVisible();
  rerender(
    <TraceTable
      traces={traceHistory}
      reloads={observedReloads}
      sort={{ key: "durationMs", direction: "descending" }}
    />,
  );
  expect(screen.queryByText("Agent reloaded")).toBeNull();
  expect(
    screen.getByText(/Reload markers appear when sorted by Started/),
  ).toBeVisible();
  expect(screen.getAllByRole("row")).toHaveLength(5);
});

test("multiple trace result regions accept distinct accessible labels", () => {
  render(
    <>
      <TraceTable traces={[]} aria-label="First result set" />
      <TraceTable traces={[]} aria-label="Second result set" />
    </>,
  );
  expect(
    screen.getByRole("region", { name: "First result set" }),
  ).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Second result set" }),
  ).toBeVisible();
});

test("operation detail stays part of the full-cell action and its accessible name", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(
    <TraceTable
      traces={[{ traceId: "example", label: "Inspect logs" }]}
      onSelectTrace={select}
      renderOperationDetail={() => "Matched tool output: ECONNRESET"}
    />,
  );
  const action = screen.getByRole("button", {
    name: /Inspect logs/,
  });
  expect(action).toHaveAccessibleName(
    expect.stringContaining("Matched tool output: ECONNRESET"),
  );
  await user.click(action);
  expect(select).toHaveBeenCalledWith("example");
});
