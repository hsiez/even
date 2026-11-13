export const spans = [
  {
    spanId: "root",
    name: "Agent activation",
    startTimeNs: "1000000000",
    endTimeNs: "5200000000",
    attributes: { "agent.name": "support" },
    statusCode: 2,
    statusMessage: "Tool failed",
  },
  {
    spanId: "model",
    parentSpanId: "root",
    name: "Model call",
    startTimeNs: "1000000000",
    endTimeNs: "2000000000",
    attributes: { model: "fixture-model" },
    statusCode: 1,
  },
  {
    spanId: "tool",
    parentSpanId: "root",
    name: "Read deployment logs",
    startTimeNs: "2000000000",
    endTimeNs: "5200000000",
    attributes: { input: "deployment-42" },
    statusCode: 2,
    statusMessage: "Permission denied",
  },
];
export const trace = {
  traceId: "a".repeat(32),
  label: "Investigate deployment",
  startedAt: "2026-11-12T18:42:08Z",
  durationMs: 4200,
  agentNames: ["support"],
  modelCalls: 1,
  toolCalls: 1,
  spanCount: 3,
  errorSpanCount: 1,
  complete: true,
  spans,
};
export const agents = [
  { id: "support", name: "Support" },
  { id: "research", name: "Research" },
];
export const sessions = [
  { id: "session-1", title: "Deployment investigation" },
  { id: "session-2", title: "Follow-up" },
];
