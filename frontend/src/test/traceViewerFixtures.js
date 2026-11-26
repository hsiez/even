// Synthetic OTLP-reader-shaped records. No model calls or backend requests.
const traceId = "11111111111111111111111111111111";
const origin = 1795200000000000000n;
function span(id, parent, name, start, duration, attributes = {}, extra = {}) {
  return {
    traceId,
    spanId: id,
    ...(parent ? { parentSpanId: parent } : {}),
    name,
    startTimeNs: (origin + BigInt(start) * 1000000n).toString(),
    endTimeNs: (origin + BigInt(start + duration) * 1000000n).toString(),
    statusCode: 0,
    attributes: { "agent.trace.schema.version": 4, ...attributes },
    events: [],
    ...extra,
  };
}
const activation = (name) => ({
  "gen_ai.operation.name": "invoke_agent",
  "gen_ai.agent.name": name,
  "agent.turn.id": `turn-${name}`,
});
const step = (index) => ({
  "agent.step.index": index,
  "gen_ai.operation.name": "workflow",
});
const model = {
  "gen_ai.operation.name": "chat",
  "gen_ai.request.model": "fixture-model",
  "gen_ai.usage.input_tokens": 128,
  "gen_ai.usage.output_tokens": 42,
};
export const viewerTrace = {
  traceId,
  label: "Deployment investigation · fixture",
  conversationIds: ["fixture-conversation"],
  spans: [
    span(
      "support",
      null,
      "invoke_agent Support",
      0,
      4800,
      activation("Support"),
    ),
    span("step-0", "support", "agent.step", 0, 1500, step(0)),
    span("model-0", "step-0", "chat fixture-model", 0, 500, {
      ...model,
      "gen_ai.input.messages": JSON.stringify([
        { role: "user", content: "Investigate the failed deployment." },
      ]),
    }),
    span(
      "logs",
      "step-0",
      "execute_tool read_logs",
      500,
      420,
      {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "read_logs",
        "gen_ai.tool.call.arguments": JSON.stringify({
          service: "api",
          limit: 20,
        }),
        "gen_ai.tool.call.result": JSON.stringify({
          error: "ECONNREFUSED",
          retryable: true,
        }),
      },
      {
        statusCode: 2,
        statusMessage: "Connection refused",
        events: [
          {
            name: "exception",
            timeNs: (origin + 900000000n).toString(),
            attributes: { "exception.message": "Connection refused" },
          },
        ],
      },
    ),
    span("dispatch", "step-0", "execute_tool research", 950, 500, {
      "gen_ai.operation.name": "execute_tool",
      "agent.action.kind": "subagent-call",
      "agent.action.name": "Research",
    }),
    span(
      "research",
      "dispatch",
      "invoke_agent Research",
      960,
      480,
      activation("Research"),
    ),
    span("research-step", "research", "agent.step", 960, 460, step(0)),
    span(
      "research-model",
      "research-step",
      "chat fixture-model",
      960,
      100,
      model,
    ),
    span(
      "source-dispatch",
      "research-step",
      "execute_tool source_check",
      1070,
      300,
      {
        "gen_ai.operation.name": "execute_tool",
        "agent.action.kind": "subagent-call",
        "agent.action.name": "Source checking",
      },
    ),
    span(
      "source",
      "source-dispatch",
      "invoke_agent Source checking",
      1080,
      280,
      activation("Source checking"),
    ),
    span("source-step", "source", "agent.step", 1080, 250, step(0)),
    span("source-tool", "source-step", "execute_tool search", 1100, 200, {
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": "search",
      "gen_ai.tool.call.result": JSON.stringify({
        matches: ["Check service health before retrying."],
      }),
    }),
    span("step-1", "support", "agent.step", 1550, 3250, step(1)),
    span("skill", "step-1", "execute_tool deployment_debugging", 1550, 50, {
      "gen_ai.operation.name": "execute_tool",
      "agent.action.kind": "load-skill",
      "agent.action.name": "deployment_debugging",
      "gen_ai.tool.call.result":
        "# Procedure\nCheck health, then inspect configuration.",
    }),
    span("custom", "step-1", "custom.cache.inspect", 1700, 80, {
      "cache.hit": false,
      "custom.count": 3,
    }),
    span("model-1", "step-1", "chat fixture-model", 1800, 3000, {
      ...model,
      "gen_ai.output.messages": JSON.stringify([
        {
          role: "assistant",
          content:
            "The API service refused the connection. Check its health before retrying.",
        },
      ]),
    }),
  ],
};
export const longViewerTrace = {
  ...viewerTrace,
  spans: [
    ...viewerTrace.spans.map((span) =>
      span.spanId === "model-1"
        ? {
            ...span,
            attributes: {
              ...span.attributes,
              "fixture.records": Array.from({ length: 40 }, (_, index) => ({
                index,
                detail: "Simulated captured observation",
              })),
              "fixture.wide": "Long captured detail ".repeat(40),
            },
          }
        : span,
    ),
    ...Array.from({ length: 50 }, (_, index) =>
      span(
        `extra-${index}`,
        "step-1",
        `execute_tool inspect_${index + 1}`,
        1800 + index * 20,
        20,
        {
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": `inspect_${index + 1}`,
        },
      ),
    ),
  ],
};
export const partialViewerTrace = {
  traceId: "22222222222222222222222222222222",
  spans: [
    span("orphan", "missing", "custom.incomplete", 0, 20, {
      note: "Parent span unavailable",
    }),
    ...[
      { spanId: "cycle-a", parentSpanId: "cycle-b" },
      { spanId: "cycle-b", parentSpanId: "cycle-a" },
    ].map((record) => ({
      ...span(record.spanId, record.parentSpanId, "custom.cycle", 0, 20),
      ...record,
    })),
  ],
};
export const rootPathSpans = viewerTrace.spans.filter((entry) =>
  [
    "support",
    "step-0",
    "model-0",
    "logs",
    "dispatch",
    "research",
    "step-1",
    "skill",
    "custom",
    "model-1",
  ].includes(entry.spanId),
);
