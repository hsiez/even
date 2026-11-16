import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CellOverflow } from "./CellOverflow";

test("masking preserves semantic children and exposes the full label once", () => {
  const { rerender } = render(
    <button>
      <CellOverflow>
        <time dateTime="2026-11-14">Inspect 👩🏽‍💻 deployment</time>
      </CellOverflow>
    </button>,
  );
  expect(screen.getByRole("button")).toHaveAccessibleName(
    "Inspect 👩🏽‍💻 deployment",
  );
  expect(screen.getByText("Inspect 👩🏽‍💻 deployment")).toHaveAttribute(
    "datetime",
    "2026-11-14",
  );
  expect(screen.getByText("…")).toHaveAttribute("aria-hidden", "true");
  rerender(
    <button>
      <CellOverflow>Updated é label</CellOverflow>
    </button>,
  );
  expect(screen.getByRole("button")).toHaveAccessibleName("Updated é label");
  expect(screen.queryByText("Inspect 👩🏽‍💻 deployment")).toBeNull();
});
