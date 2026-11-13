import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "./Popover";
test("opens named interactive content and closes with focus restoration", async () => {
  const user = userEvent.setup();
  render(
    <Popover>
      <Popover.Trigger>Filters</Popover.Trigger>
      <Popover.Content>
        <Popover.Title>Trace filters</Popover.Title>
        <Popover.Description>Choose results</Popover.Description>
        <label>
          <input type="checkbox" />
          Errors only
        </label>
        <Popover.Close>Apply</Popover.Close>
      </Popover.Content>
    </Popover>,
  );
  const trigger = screen.getByRole("button", { name: "Filters" });
  await user.click(trigger);
  expect(
    await screen.findByRole("dialog", { name: "Trace filters" }),
  ).toHaveAccessibleDescription("Choose results");
  await user.click(screen.getByRole("checkbox", { name: "Errors only" }));
  expect(screen.getByRole("checkbox")).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
});
