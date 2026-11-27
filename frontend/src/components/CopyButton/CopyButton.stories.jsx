import React from "react";
import { CopyButton } from "./CopyButton";
import { trace } from "../../test/fixtures";

export default { title: "Primitives/CopyButton", component: CopyButton };

export const Default = {
  render: function Example() {
    return <CopyButton value={trace.traceId} label="Copy trace ID" />;
  },
};
export const IconOnly = {
  render: () => (
    <CopyButton iconOnly value={trace.traceId} label="Copy trace ID" />
  ),
};
