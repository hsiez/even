import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { Sidebar } from "./Sidebar";

test("names navigation and preserves the current destination", () => {
  render(
    <Sidebar>
      <a href="/traces" aria-current="page">
        Traces
      </a>
    </Sidebar>,
  );
  expect(
    screen.getByRole("navigation", { name: "Workbench navigation" }),
  ).toBeVisible();
  expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
});
