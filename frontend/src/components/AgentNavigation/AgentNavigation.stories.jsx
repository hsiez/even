import React from "react";
import { AgentNavigation } from "./AgentNavigation";

export default {
  title: "Workbench/AgentNavigation",
  component: AgentNavigation,
};

export const Default = {
  render: function Example() {
    return <AgentNavigation agentId="support" current="traces" />;
  },
};
