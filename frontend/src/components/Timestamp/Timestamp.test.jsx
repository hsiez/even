import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "./Timestamp";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("exposes ISO datetime and timezone and handles missing or invalid dates", () => {
  const { rerender } = render(<Timestamp value="2026-11-12T18:42:08Z" />);
  expect(screen.getByText(/2026/)).toHaveAttribute(
    "datetime",
    "2026-11-12T18:42:08.000Z",
  );
  expect(screen.getByText(/2026/)).toHaveTextContent("UTC");
  rerender(<Timestamp value="bad" />);
  expect(screen.getByText("Unknown time")).toBeVisible();
  rerender(<Timestamp />);
  expect(screen.getByText("Unknown time")).toBeVisible();
});
