import React, { useState } from "react";
import { Dialog } from "./Dialog";
import { TextField } from "../TextField/TextField";
export default { title: "Primitives/Dialog", component: Dialog };
export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <Dialog>
          <Dialog.Trigger>Open settings</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Agent settings</Dialog.Title>
            <Dialog.Description>
              Settings apply to the selected agent.
            </Dialog.Description>
            <TextField label="Agent name" defaultValue="Support" />
            <Dialog.Close>Close settings</Dialog.Close>
          </Dialog.Content>
        </Dialog>
        <output>{value}</output>
      </>
    );
  },
};
export const InitiallyOpen = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <Dialog defaultOpen>
          <Dialog.Trigger>Open settings</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Agent settings</Dialog.Title>
            <Dialog.Description>
              Settings apply to the selected agent.
            </Dialog.Description>
            <TextField label="Agent name" defaultValue="Support" />
            <Dialog.Close>Close settings</Dialog.Close>
          </Dialog.Content>
        </Dialog>
        <output>{value}</output>
      </>
    );
  },
};
