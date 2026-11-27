import React from "react";
import { ViewExecutionAction } from "./ViewExecutionAction";
import { trace } from "../../test/fixtures";

export default {
  title: "Workbench/ViewExecutionAction",
  component: ViewExecutionAction,
};

export const Default = {
  render: function Example() {
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
    return <ViewExecutionAction pending />;
  },
};

export const Unavailable = {
  render: function Example() {
    return <ViewExecutionAction />;
  },
};

export const Multiple = {
  render: function Example() {
    return (
      <ViewExecutionAction
        traces={[trace, { traceId: "b" }]}
        hrefForTrace={(id) => `#trace-${id}`}
      />
    );
  },
};
