import React from "react";
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGrid } from "./MotionGrid";

test("documents aliases and lets each preview and instance be controlled independently", async () => {
  const user = userEvent.setup();
  render(
    <>
      <MotionGrid />
      <MotionGrid theme="dark" />
    </>,
  );
  const [first, second] = screen.getAllByRole("region", {
    name: /Motion tokens/,
  });
  expect(within(first).getByRole("table")).toHaveTextContent(
    "options.easing.in-out-cubic",
  );
  const entry = within(first).getByRole("button", { name: "Preview enter" });
  await user.click(entry);
  expect(entry).toHaveAttribute("aria-pressed", "true");
  expect(
    within(first).getByRole("button", { name: "Preview move" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    within(second).getByRole("button", { name: "Preview enter" }),
  ).toHaveAttribute("aria-pressed", "false");
  await user.keyboard("{Enter}");
  expect(entry).toHaveAttribute("aria-pressed", "false");
});
