import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Duration } from "./Duration";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("distinguishes zero, seconds and missing duration", () => {
  const { rerender } = render(<Duration milliseconds={0} />);
  expect(screen.getByText("0 ms")).toBeVisible();
  rerender(<Duration milliseconds={4200} />);
  expect(screen.getByText("4.20 s")).toBeVisible();
  rerender(<Duration />);
  expect(screen.getByText("Unknown duration")).toBeVisible();
});
