import React from "react";
import { Timestamp } from "./Timestamp";
import { trace } from "../../test/fixtures";

export default { title: "Primitives/Timestamp", component: Timestamp };

export const Default = {
  render: function Example() {
    return <Timestamp value={trace.startedAt} />;
  },
};

export const Missing = {
  render: function Example() {
    return <Timestamp />;
  },
};
