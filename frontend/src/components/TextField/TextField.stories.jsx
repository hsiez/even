import React, { useState } from "react";
import { TextField } from "./TextField";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/TextField", component: TextField };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <TextField
        label="Search traces"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        description="Search recorded operations"
      />
    );
  },
};

export const Error = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <TextField
        label="Query"
        error="Invalid expression"
        defaultValue="status:"
      />
    );
  },
};

export const ReadOnly = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TextField label="Trace ID" readOnly value={trace.traceId} />;
  },
};
