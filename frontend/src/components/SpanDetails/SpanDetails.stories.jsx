import React from "react";
import { SpanDetails } from "./SpanDetails";
import { spans } from "../../test/fixtures";

export default { title: "Workbench/SpanDetails", component: SpanDetails };

export const Default = {
  render: function Example() {
    return <SpanDetails span={spans[2]} />;
  },
};

export const NoSelection = {
  render: function Example() {
    return <SpanDetails />;
  },
};
