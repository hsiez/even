import React from "react";
import { TraceRawPanel } from "./TraceRawPanel";
import { viewerTrace } from "../../test/traceViewerFixtures";
import { traceTokenUsage } from "../../traces/traceModel";
import "../TraceViewer/TraceViewer.stories.css";
export default {
  title: "Trace viewer/TraceRawPanel",
  component: TraceRawPanel,
};
export const Default = {
  render: () => (
    <div className="even-trace-raw-story">
      <TraceRawPanel
        span={viewerTrace.spans.find((span) => span.spanId === "logs")}
      />
    </div>
  ),
};
export const LongPayload = {
  render: () => (
    <div className="even-trace-raw-story">
      <TraceRawPanel
        span={{
          ...viewerTrace.spans[0],
          attributes: { "fixture.long": "Captured value ".repeat(200) },
        }}
      />
    </div>
  ),
};
export const StepUsage = {
  render: () => (
    <TraceRawPanel
      span={viewerTrace.spans.find((span) => span.spanId === "step-0")}
      tokenUsage={traceTokenUsage(viewerTrace.spans).get("step-0")}
    />
  ),
};
export const PartialUsage = {
  render: () => (
    <TraceRawPanel
      span={viewerTrace.spans.find((span) => span.spanId === "model-0")}
      tokenUsage={{ count: 128, partial: true }}
    />
  ),
};
export const ZeroUsage = {
  render: () => (
    <TraceRawPanel
      span={viewerTrace.spans.find((span) => span.spanId === "model-0")}
      tokenUsage={{ count: 0, partial: false }}
    />
  ),
};
export const UnknownMetrics = {
  render: () => (
    <TraceRawPanel
      span={{ spanId: "unknown", name: "custom.operation", attributes: {} }}
    />
  ),
};
export const Empty = { render: () => <TraceRawPanel /> };
export const Loading = { render: () => <TraceRawPanel loading /> };
export const Error = {
  render: () => (
    <TraceRawPanel
      error="Could not read the selected span."
      onRetry={() => {}}
    />
  ),
};
