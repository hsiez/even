import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceStatus } from "./TraceStatus";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("never infers success from absent error data", () => {
  const { rerender } = render(<TraceStatus />);
  expect(screen.getByText("Completion unknown")).toBeVisible();
  rerender(<TraceStatus errorCount={0} />);
  expect(screen.getByText("Completion unknown")).toBeVisible();
  rerender(<TraceStatus complete errorCount={2} />);
  expect(screen.getByText("Errors recorded")).toBeVisible();
});
