import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceSummary } from "./TraceSummary";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("shows trace-wide counts and does not invent unavailable metrics", () => {
  const { rerender } = render(<TraceSummary trace={trace} />);
  expect(
    screen.getByText("Trace-wide spans").nextElementSibling,
  ).toHaveTextContent("3");
  rerender(<TraceSummary trace={{ traceId: "unknown" }} />);
  expect(screen.getByText("Completion unknown")).toBeVisible();
  expect(
    screen.getByText("Trace-wide model calls").nextElementSibling,
  ).toHaveTextContent("Unknown");
});
