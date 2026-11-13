import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkbenchLayout } from "./WorkbenchLayout";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("exposes one main landmark and preserves navigation with an inspector", () => {
  render(
    <WorkbenchLayout
      navigation={<nav aria-label="Agents">Support</nav>}
      inspector={<aside aria-label="Details">Span</aside>}
    >
      Results
    </WorkbenchLayout>,
  );
  expect(
    screen.getByRole("main", { name: "Trace workbench" }),
  ).toHaveTextContent("Results");
  expect(screen.getByRole("navigation", { name: "Agents" })).toBeVisible();
  expect(screen.getByRole("complementary", { name: "Details" })).toBeVisible();
});
