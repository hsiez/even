import React, { useState } from "react";
import { AttributeList } from "./AttributeList";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/AttributeList", component: AttributeList };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <AttributeList
        attributes={{
          "agent.name": "support",
          attempt: 2,
          input: { query: "deployment" },
          missing: null,
        }}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <AttributeList />;
  },
};
