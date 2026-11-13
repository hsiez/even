import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsState } from "./ResultsState";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("distinguishes empty, no matches, stale loading and retryable errors", async () => {
  const retry = vi.fn(),
    user = userEvent.setup();
  const { rerender } = render(<ResultsState state="empty" />);
  expect(screen.getByRole("status")).toHaveTextContent("No recorded traces");
  rerender(<ResultsState state="no-matches" />);
  expect(screen.getByRole("status")).toHaveTextContent("No traces match");
  rerender(
    <ResultsState state="loading">
      <p>Old result</p>
    </ResultsState>,
  );
  expect(screen.getByText("Old result")).toBeVisible();
  expect(screen.getByRole("status").parentElement).toHaveAttribute(
    "aria-busy",
    "true",
  );
  rerender(<ResultsState state="error" error="Read failed" onRetry={retry} />);
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
