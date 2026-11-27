import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { Notice } from "./Notice";

test("announces urgent failures separately from ordinary status", () => {
  const { rerender } = render(<Notice>Recorded spans only</Notice>);
  expect(screen.getByRole("status")).toHaveTextContent("Recorded spans only");
  rerender(<Notice urgent>Read failed</Notice>);
  expect(screen.getByRole("alert")).toHaveTextContent("Read failed");
});
