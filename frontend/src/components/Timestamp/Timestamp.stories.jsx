import React, { useState } from "react";
import { Timestamp } from "./Timestamp";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Timestamp", component: Timestamp };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Timestamp value={trace.startedAt} />;
  },
};

export const Missing = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Timestamp />;
  },
};
