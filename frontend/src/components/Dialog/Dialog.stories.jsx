import React, { useState } from "react";
import { Dialog } from "./Dialog";
import { TextField } from "../TextField/TextField";
import { Popover } from "../Popover/Popover";
import { Select } from "../Select/Select";
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

// Exercise both nesting directions: popover → modal → floating controls.
export const NestedOverlays = {
  render: () => (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <Popover>
        <Popover.Trigger>Open outer popover</Popover.Trigger>
        <Popover.Content>
          <Popover.Title>Outer popover</Popover.Title>
          <Popover.Description>
            Open settings without losing this context.
          </Popover.Description>
          <Dialog>
            <Dialog.Trigger>Open nested dialog</Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>Nested dialog</Dialog.Title>
              <Dialog.Description>
                Floating controls should remain usable inside this modal.
              </Dialog.Description>
              <Select
                label="Trace outcome"
                defaultValue="all"
                options={[
                  { value: "all", label: "All outcomes" },
                  { value: "errors", label: "Errors only" },
                ]}
              />
              <Popover>
                <Popover.Trigger>Open dialog popover</Popover.Trigger>
                <Popover.Content>
                  <Popover.Title>Dialog popover</Popover.Title>
                  <Popover.Description>
                    A child overlay above the modal.
                  </Popover.Description>
                  <Popover.Close>Close dialog popover</Popover.Close>
                </Popover.Content>
              </Popover>
              <Dialog.Close>Close nested dialog</Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </Popover.Content>
      </Popover>
    </div>
  ),
};
