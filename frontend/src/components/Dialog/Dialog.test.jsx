import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";
test("labels the modal, dismisses with Escape, and restores trigger focus", async () => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <Dialog.Trigger>Settings</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Agent settings</Dialog.Title>
        <Dialog.Description>Selected agent configuration</Dialog.Description>
        <button>Save settings</button>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>,
  );
  const trigger = screen.getByRole("button", { name: "Settings" });
  await user.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Agent settings" });
  expect(dialog).toHaveAccessibleDescription("Selected agent configuration");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
});
test("controlled dialogs notify the caller and support explicit close", async () => {
  const user = userEvent.setup();
  function Example() {
    const [open, setOpen] = React.useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Details</Dialog.Title>
          <Dialog.Close>Done</Dialog.Close>
        </Dialog.Content>
      </Dialog>
    );
  }
  render(<Example />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  await user.click(await screen.findByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
