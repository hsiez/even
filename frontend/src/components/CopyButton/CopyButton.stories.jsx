import React, { useState } from "react";
import { CopyButton } from "./CopyButton";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/CopyButton", component: CopyButton };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <CopyButton value={trace.traceId} label="Copy trace ID" />;
  },
};
