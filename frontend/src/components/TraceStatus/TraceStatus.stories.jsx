import React from "react";
import { TraceStatus } from "./TraceStatus";
import { Notice } from "../Notice/Notice";

export default { title: "Primitives/TraceStatus", component: TraceStatus };

export const Unknown = {
  render: function Example() {
    return <TraceStatus />;
  },
};

export const Error = {
  render: function Example() {
    return <TraceStatus errorCount={1} />;
  },
};

export const Complete = {
  render: function Example() {
    return <TraceStatus complete errorCount={0} />;
  },
};

export const SurfaceHierarchy = {
  parameters: {
    docs: {
      description: {
        story:
          "Compact status labels use a stronger tint than larger notices. Both keep their semantic text colors. Switch themes to compare the hierarchy.",
      },
    },
  },
  render: () => (
    <div style={{ display: "grid", gap: "var(--even-space-gap-group)" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--even-space-gap-related)",
        }}
      >
        <TraceStatus errorCount={1} />
        <TraceStatus complete />
        <TraceStatus />
      </div>
      <Notice>Only recorded operations are shown.</Notice>
      <Notice urgent>Could not read the trace store.</Notice>
    </div>
  ),
};
