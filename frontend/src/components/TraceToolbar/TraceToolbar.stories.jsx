import React, { useState } from "react";
import { TraceToolbar } from "./TraceToolbar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/TraceToolbar", component: TraceToolbar };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <TraceToolbar
        query={value}
        onQueryChange={setValue}
        onRefresh={() => {}}
        filters={[]}
      />
    );
  },
};

export const Refreshing = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceToolbar query={value} onQueryChange={setValue} refreshing />;
  },
};
