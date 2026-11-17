import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceToolbar } from "./TraceToolbar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("changes search without clearing filters and prevents duplicate refresh", async () => {
  const user = userEvent.setup(),
    query = vi.fn(),
    clear = vi.fn(),
    refresh = vi.fn();
  const { rerender } = render(
    <TraceToolbar
      query="tool"
      onQueryChange={query}
      filters={[{ id: "a", label: "Agent" }]}
      onRemoveFilter={() => {}}
      onClearFilters={clear}
      onRefresh={refresh}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect(query).toHaveBeenCalledWith("");
  expect(clear).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  expect(refresh).toHaveBeenCalledOnce();
  rerender(
    <TraceToolbar
      refreshing
      query=""
      onQueryChange={query}
      onRefresh={refresh}
    />,
  );
  expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
});

test("omits refresh when no refresh action is available", () => {
  render(<TraceToolbar query="" onQueryChange={() => {}} />);
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  expect(
    screen.getByRole("searchbox", { name: "Search traces" }),
  ).toBeVisible();
});

test("accepts a supplied search control without duplicating the default input", () => {
  render(<TraceToolbar searchControl={<input aria-label="Custom search" />} />);
  expect(screen.getByRole("textbox", { name: "Custom search" })).toBeVisible();
  expect(screen.queryByRole("searchbox")).toBeNull();
});
