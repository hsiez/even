import React, { useState } from "react";
import { AgentNavigation } from "./AgentNavigation";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default {
  title: "Workbench/AgentNavigation",
  component: AgentNavigation,
};

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <AgentNavigation agentId="support" current="traces" />;
  },
};
