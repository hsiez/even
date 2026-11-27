import React, { useState } from "react";
import { Popover } from "./Popover";
export default { title: "Primitives/Popover", component: Popover };
export const Default = {
  render: function Example() {
    const [value] = useState("");
    return (
      <>
        <Popover>
          <Popover.Trigger>Filter options</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>Filter traces</Popover.Title>
            <Popover.Description>
              Choose which recorded traces to show.
            </Popover.Description>
            <label>
              <input type="checkbox" />
              Errors only
            </label>
            <Popover.Close>Apply filters</Popover.Close>
          </Popover.Content>
        </Popover>
        <output>{value}</output>
      </>
    );
  },
};
export const InitiallyOpen = {
  parameters: {
    docs: {
      description: {
        story:
          "Floating panels share a soft translucent-black cast shadow in both themes. Switch themes to review the shadow and the persistent panel boundary.",
      },
    },
  },
  render: function Example() {
    const [value] = useState("");
    return (
      <>
        <Popover defaultOpen>
          <Popover.Trigger>Filter options</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>Filter traces</Popover.Title>
            <Popover.Description>
              Choose which recorded traces to show.
            </Popover.Description>
            <label>
              <input type="checkbox" />
              Errors only
            </label>
            <Popover.Close>Apply filters</Popover.Close>
          </Popover.Content>
        </Popover>
        <output>{value}</output>
      </>
    );
  },
};
