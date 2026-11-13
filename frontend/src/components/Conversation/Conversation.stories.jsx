import React, { useState } from "react";
import { Conversation } from "./Conversation";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/Conversation", component: Conversation };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Conversation
        messages={[
          { id: "1", role: "user", content: "Why did deployment fail?" },
          {
            id: "2",
            role: "agent",
            content: "The logs indicate a permissions error.",
          },
        ]}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Conversation />;
  },
};

export const UpdatedMessage = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Conversation
        messages={[
          { id: "1", role: "agent", content: "Checking" },
          { id: "1", role: "agent", content: "Checking deployment logs…" },
        ]}
      />
    );
  },
};
