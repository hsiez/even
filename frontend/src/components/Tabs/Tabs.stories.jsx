import React, { useState } from "react";
import { Tabs } from "./Tabs";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Tabs", component: Tabs };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Tabs defaultValue="overview">
        <Tabs.List label="Trace sections">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="attributes">Attributes</Tabs.Trigger>
          <Tabs.Trigger value="disabled" disabled>
            Unavailable
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="overview">Execution summary</Tabs.Panel>
        <Tabs.Panel value="attributes">Span attributes</Tabs.Panel>
        <Tabs.Panel value="disabled">Unavailable</Tabs.Panel>
      </Tabs>
    );
  },
};

export const ControlledVertical = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Tabs
        value={value || "one"}
        onValueChange={setValue}
        orientation="vertical"
      >
        <Tabs.List label="Sections">
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">First</Tabs.Panel>
        <Tabs.Panel value="two">Second</Tabs.Panel>
      </Tabs>
    );
  },
};
