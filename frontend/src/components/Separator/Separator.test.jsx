import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { Separator } from "./Separator";
test("exposes horizontal and vertical separator semantics", () => {
  const { rerender } = render(<Separator />);
  expect(screen.getByRole("separator")).toBeInTheDocument();
  rerender(<Separator orientation="vertical" />);
  expect(screen.getByRole("separator")).toHaveAttribute(
    "aria-orientation",
    "vertical",
  );
});
