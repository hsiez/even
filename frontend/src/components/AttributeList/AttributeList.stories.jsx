import React from "react";
import { AttributeList } from "./AttributeList";

export default { title: "Workbench/AttributeList", component: AttributeList };

export const Default = {
  render: function Example() {
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
    return <AttributeList />;
  },
};
