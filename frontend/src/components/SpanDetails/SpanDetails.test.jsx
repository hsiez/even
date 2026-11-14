import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpanDetails } from "./SpanDetails";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("updates the selected operation, error and missing selection", () => {
  const { rerender } = render(<SpanDetails />);
  expect(screen.getByText("Select a span to inspect.")).toBeVisible();
  rerender(<SpanDetails span={spans[2]} />);
  expect(screen.getByRole("heading")).toHaveTextContent("Read deployment logs");
  expect(screen.getByText("Permission denied")).toBeVisible();
  rerender(<SpanDetails span={spans[1]} />);
  expect(screen.queryByText("Permission denied")).toBeNull();
  expect(screen.getByRole("heading")).toHaveTextContent("Model call");
});
