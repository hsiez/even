import React, { useState } from "react";
import { TextField } from "./TextField";
import { trace } from "../../test/fixtures";

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
        placeholder="Inspect deployment"
      />
    );
  },
};

export const Error = {
  render: function Example() {
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
    return <TextField label="Trace ID" readOnly value={trace.traceId} />;
  },
};
