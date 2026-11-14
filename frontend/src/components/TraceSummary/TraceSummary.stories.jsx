import React, { useState } from "react";
import { TraceSummary } from "./TraceSummary";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/TraceSummary", component: TraceSummary };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceSummary trace={trace} />;
  },
};

export const MissingMetadata = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceSummary trace={{ traceId: "unknown" }} />;
  },
};
