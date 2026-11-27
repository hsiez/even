import React, { StrictMode } from "react";
import { test, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useColumnWidths } from "./useColumnWidths";

test("batched resize actions preserve every column and emit each complete map once in Strict Mode", () => {
  const onColumnWidthsChange = vi.fn();
  const tableRef = { current: document.createElement("table") };
  const { result, unmount } = renderHook(
    () => useColumnWidths({ tableRef, onColumnWidthsChange }),
    {
      wrapper: ({ children }) =>
        React.createElement(StrictMode, null, children),
    },
  );
  act(() => {
    const resize = result.current.resize;
    resize({ id: "durationMs" }, 160);
    resize({ id: "agent" }, 208);
    resize({ id: "durationMs" }, 176);
    resize({ id: "durationMs" }, 176);
  });
  expect(onColumnWidthsChange.mock.calls.map(([widths]) => widths)).toEqual([
    { durationMs: 160 },
    { durationMs: 160, agent: 208 },
    { durationMs: 176, agent: 208 },
  ]);
  expect(
    result.current.columns.find((column) => column.id === "durationMs").width,
  ).toBe(176);
  expect(
    result.current.columns.find((column) => column.id === "agent").width,
  ).toBe(208);
  unmount();
});
