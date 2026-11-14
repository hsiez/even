import React, { useState } from "react";
import { SpanDetails } from "./SpanDetails";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/SpanDetails", component: SpanDetails };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <SpanDetails span={spans[2]} />;
  },
};

export const NoSelection = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <SpanDetails />;
  },
};
