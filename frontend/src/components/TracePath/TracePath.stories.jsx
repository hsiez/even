import React from "react";
import { TracePath } from "./TracePath";
import {
  rootPathSpans,
  partialViewerTrace,
} from "../../test/traceViewerFixtures";
export default { title: "Trace viewer/TracePath", component: TracePath };
export const Default = {
  render: () => (
    <TracePath
      spans={rootPathSpans}
      defaultSelectedSpanId="logs"
      defaultExpandedSpanIds={["support", "step-0", "step-1", "dispatch"]}
    />
  ),
};
export const Collapsed = {
  render: () => (
    <TracePath spans={rootPathSpans} defaultSelectedSpanId="step-0" />
  ),
};
export const LongTitles = {
  render: () => (
    <div style={{ maxWidth: "var(--even-size-panel-preferred)" }}>
      <TracePath
        spans={rootPathSpans.map((span) =>
          span.spanId === "logs"
            ? {
                ...span,
                attributes: {
                  ...span.attributes,
                  "gen_ai.tool.name":
                    "read_deployment_logs_for_the_production_api_and_report_connection_failures",
                },
              }
            : span,
        )}
        defaultSelectedSpanId="step-1"
        defaultExpandedSpanIds={["support", "step-0", "step-1", "dispatch"]}
      />
    </div>
  ),
};
export const MissingParentsAndCycles = {
  render: () => <TracePath spans={partialViewerTrace.spans} />,
};
export const Empty = { render: () => <TracePath /> };

export const NoSteps = {
  render: () => (
    <TracePath
      spans={rootPathSpans.filter((span) => span.name !== "agent.step")}
      defaultExpandedSpanIds={["support", "dispatch"]}
    />
  ),
};
export const ActivationOnly = {
  render: () => (
    <TracePath
      spans={rootPathSpans.filter((span) => span.spanId === "support")}
    />
  ),
};
