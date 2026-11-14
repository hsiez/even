import React, { useState } from "react";
import { TraceTable } from "./TraceTable";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/TraceTable", component: TraceTable };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <TraceTable
        traces={[trace, { traceId: "b", label: "Unknown execution" }]}
        selectedTraceId={value}
        onSelectTrace={setValue}
        onSortChange={() => {}}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceTable traces={[]} />;
  },
};
