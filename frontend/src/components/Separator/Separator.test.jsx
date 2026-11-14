import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
