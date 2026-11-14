import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DimensionGrid } from "./DimensionGrid";

test("documents reference pixel equivalents without changing the root font size", () => {
  const rootSize = document.documentElement.style.fontSize;
  const { rerender } = render(<DimensionGrid />);
  expect(screen.getByRole("table")).toHaveTextContent("--even-dimension-4");
  expect(screen.getByRole("table")).toHaveTextContent("0.25rem");
  expect(document.documentElement.style.fontSize).toBe(rootSize);
  rerender(<DimensionGrid kind="size" />);
  expect(screen.getByRole("table")).toHaveTextContent(
    "--even-size-control-default",
  );
  expect(screen.getByRole("table")).toHaveTextContent("options.dimension.40");
});
