import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceTable } from "./TraceTable";
import { trace, spans, agents, sessions } from "../../test/fixtures";

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
