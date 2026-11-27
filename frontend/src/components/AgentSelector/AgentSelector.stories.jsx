import React, { useState } from "react";
import { AgentSelector } from "./AgentSelector";
import { agents } from "../../test/fixtures";

export default { title: "Workbench/AgentSelector", component: AgentSelector };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <AgentSelector
        agents={agents}
        value={value || "support"}
        onValueChange={setValue}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    return <AgentSelector agents={[]} />;
  },
};

export const UnknownSelection = {
  render: function Example() {
    return <AgentSelector agents={agents} value="removed" />;
  },
};
