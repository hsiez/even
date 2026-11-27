import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { Timestamp } from "./Timestamp";

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
