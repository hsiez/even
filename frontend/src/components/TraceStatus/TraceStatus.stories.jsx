import React, { useState } from "react";
import { TraceStatus } from "./TraceStatus";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/TraceStatus", component: TraceStatus };

export const Unknown = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceStatus />;
  },
};

export const Error = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceStatus errorCount={1} />;
  },
};

export const Complete = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceStatus complete errorCount={0} />;
  },
};
