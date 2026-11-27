import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { TraceStatus } from "./TraceStatus";

test("never infers success from absent error data", () => {
  const { rerender } = render(<TraceStatus />);
  expect(screen.getByText("Completion unknown")).toBeVisible();
  rerender(<TraceStatus errorCount={0} />);
  expect(screen.getByText("Completion unknown")).toBeVisible();
  rerender(<TraceStatus complete errorCount={2} />);
  expect(screen.getByText("Errors recorded")).toBeVisible();
});
