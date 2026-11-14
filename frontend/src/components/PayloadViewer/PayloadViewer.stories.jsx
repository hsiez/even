import React, { useState } from "react";
import { PayloadViewer } from "./PayloadViewer";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/PayloadViewer", component: PayloadViewer };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <PayloadViewer
        value={{ query: "deployment", items: [1, 2] }}
        label="Tool input"
      />
    );
  },
};

export const PlainText = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <PayloadViewer value="Permission denied" />;
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <PayloadViewer value="" />;
  },
};

export const NotCaptured = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <PayloadViewer />;
  },
};
