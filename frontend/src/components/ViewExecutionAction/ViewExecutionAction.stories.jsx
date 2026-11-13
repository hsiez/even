import React, { useState } from "react";
import { ViewExecutionAction } from "./ViewExecutionAction";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default {
  title: "Workbench/ViewExecutionAction",
  component: ViewExecutionAction,
};

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <ViewExecutionAction
        traces={[trace]}
        hrefForTrace={(id) => `#trace-${id}`}
      />
    );
  },
};

export const Pending = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <ViewExecutionAction pending />;
  },
};

export const Unavailable = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <ViewExecutionAction />;
  },
};

export const Multiple = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <ViewExecutionAction
        traces={[trace, { traceId: "b" }]}
        hrefForTrace={(id) => `#trace-${id}`}
      />
    );
  },
};
