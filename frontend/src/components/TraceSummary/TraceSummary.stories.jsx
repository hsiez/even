import React from "react";
import { TraceSummary } from "./TraceSummary";
import { trace } from "../../test/fixtures";

export default { title: "Workbench/TraceSummary", component: TraceSummary };

export const Default = {
  render: function Example() {
    return <TraceSummary trace={trace} />;
  },
};

export const MissingMetadata = {
  render: function Example() {
    return <TraceSummary trace={{ traceId: "unknown" }} />;
  },
};
