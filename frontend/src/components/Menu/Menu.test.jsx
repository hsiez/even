import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";
test("supports keyboard selection, disabled items, dismissal and trigger focus", async () => {
  const user = userEvent.setup(),
    action = vi.fn();
  render(
    <Menu>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Content aria-label="Trace actions">
        <Menu.Item onClick={action}>Copy ID</Menu.Item>
        <Menu.Item disabled onClick={action}>
          Delete
        </Menu.Item>
        <Menu.Item>Export</Menu.Item>
      </Menu.Content>
    </Menu>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  await user.tab();
  await user.keyboard("{ArrowDown}");
  const copy = await screen.findByRole("menuitem", { name: "Copy ID" });
  await waitFor(() => expect(copy).toHaveFocus());
  await user.keyboard("{Enter}");
  expect(action).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  expect(action).toHaveBeenCalledTimes(1);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
});
