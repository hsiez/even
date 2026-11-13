import React, { useState } from "react";
import { SpanWaterfall } from "./SpanWaterfall";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/SpanWaterfall", component: SpanWaterfall };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SpanWaterfall spans={spans} defaultExpandedSpanIds={["root"]}>
        <SpanWaterfall.Tree />
        <SpanWaterfall.Timeline />
      </SpanWaterfall>
    );
  },
};

export const Controlled = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SpanWaterfall
        spans={spans}
        selectedSpanId={value}
        onSelectSpan={setValue}
      >
        <SpanWaterfall.Tree />
        <SpanWaterfall.Timeline />
      </SpanWaterfall>
    );
  },
};

export const MissingParent = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SpanWaterfall spans={[{ ...spans[1], parentSpanId: "missing" }]}>
        <SpanWaterfall.Tree />
        <SpanWaterfall.Timeline />
      </SpanWaterfall>
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SpanWaterfall>
        <SpanWaterfall.Tree />
        <SpanWaterfall.Timeline />
      </SpanWaterfall>
    );
  },
};
