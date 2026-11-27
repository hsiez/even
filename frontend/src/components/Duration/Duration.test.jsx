import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { Duration } from "./Duration";

test("distinguishes zero, seconds and missing duration", () => {
  const { rerender } = render(<Duration milliseconds={0} />);
  expect(screen.getByText("0 ms")).toBeVisible();
  rerender(<Duration milliseconds={4200} />);
  expect(screen.getByText("4.20 s")).toBeVisible();
  rerender(<Duration />);
  expect(screen.getByText("Unknown duration")).toBeVisible();
});
