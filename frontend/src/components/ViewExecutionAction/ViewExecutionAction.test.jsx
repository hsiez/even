import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewExecutionAction } from "./ViewExecutionAction";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("handles missing, pending and multiple mappings without inventing links", () => {
  const { rerender } = render(<ViewExecutionAction />);
  expect(screen.queryByRole("link")).toBeNull();
  rerender(<ViewExecutionAction pending />);
  expect(screen.getByRole("status")).toHaveTextContent("Waiting");
  rerender(
    <ViewExecutionAction
      traces={[trace, { traceId: "second" }]}
      hrefForTrace={(id) => `/traces/${id}`}
    />,
  );
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(
    screen.getByRole("link", { name: "View execution 2" }),
  ).toHaveAttribute("href", "/traces/second");
});
