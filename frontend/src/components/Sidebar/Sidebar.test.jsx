import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

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
