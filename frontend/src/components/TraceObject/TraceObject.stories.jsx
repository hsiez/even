import React from "react";
import { TraceObject } from "./TraceObject";
import { viewerTrace } from "../../test/traceViewerFixtures";

const span = (id) => viewerTrace.spans.find((span) => span.spanId === id);
export default { title: "Trace viewer/TraceObject", component: TraceObject };
export const Step = {
  render: () => <TraceObject span={span("step-0")} />,
};
export const Model = {
  render: () => <TraceObject span={span("model-0")} />,
};
const tool = (name) => ({
  ...span("logs"),
  name: `execute_tool ${name}`,
  attributes: {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": name,
  },
});
export const Tool = {
  render: () => <TraceObject span={tool("verify_deployment")} />,
};
export const LongName = {
  render: () => (
    <div style={{ maxWidth: "var(--even-size-navigation-preferred)" }}>
      <TraceObject
        span={{
          ...span("custom"),
          name: "inspect_deployment_configuration_and_connection_failure_diagnostics",
        }}
      />
    </div>
  ),
};

function CategoryCatalogueExample({ categoryAppearance }) {
  return (
    <section
      aria-label="Operation categories"
      style={{
        display: "grid",
        gap: "var(--even-space-gap-related)",
        maxWidth: "var(--even-size-field-preferred)",
      }}
    >
      {[
        span("step-0"),
        tool("verify_deployment"),
        span("skill"),
        span("logs"),
        tool("write_file"),
        tool("search_files"),
        span("model-0"),
        span("research"),
        span("dispatch"),
        {
          ...span("custom"),
          name: "search_memory",
          attributes: { "gen_ai.operation.name": "search_memory" },
        },
        { ...span("custom"), name: "agent.approval", attributes: {} },
        span("custom"),
      ].map((item, index) => (
        <TraceObject
          key={index}
          span={item}
          categoryAppearance={categoryAppearance}
          category={item.spanId === "research" ? "Subagent" : undefined}
        />
      ))}
    </section>
  );
}
export const CategoryCatalogue = { render: () => <CategoryCatalogueExample /> };
export const CategoryPillMockup = {
  render: () => <CategoryCatalogueExample categoryAppearance="label" />,
};
