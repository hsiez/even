// Deliberate staging data. No Eve runtime, network request or model is involved.
export const previewAgents = [
  { id: "support", name: "Support" },
  { id: "research", name: "Research" },
  { id: "release", name: "Release" },
];

const operations = [
  [
    "support",
    "Investigate deployment failure",
    "error",
    4200,
    "Read deployment logs",
  ],
  [
    "research",
    "Find references for the retry policy",
    "complete",
    1870,
    "Search documentation",
  ],
  [
    "release",
    "Check production deployment health",
    "complete",
    680,
    "Read deployment status",
  ],
  [
    "support",
    "Inspect agent configuration",
    "complete",
    1240,
    "Read configuration",
  ],
  [
    "research",
    "Summarize the incident timeline",
    "complete",
    6300,
    "Read incident notes",
  ],
  [
    "release",
    "Validate release permissions",
    "error",
    920,
    "Check permissions",
  ],
  [
    "support",
    "Read customer conversation context",
    "complete",
    540,
    "Read conversation",
  ],
  [
    "research",
    "Compare cache eviction strategies",
    "complete",
    8140,
    "Search documentation",
  ],
  [
    "release",
    "Inspect the staging environment",
    "complete",
    2120,
    "Read environment",
  ],
  [
    "support",
    "Prepare an incident response",
    "unknown",
    undefined,
    "Read incident notes",
  ],
  [
    "research",
    "Find related agent traces",
    "complete",
    3400,
    "Search trace history",
  ],
  [
    "release",
    "Verify the rollback configuration",
    "complete",
    760,
    "Read configuration",
  ],
];

export function createSampleTrace(
  sequence,
  startedAt = new Date().toISOString(),
) {
  const [agentId, label, outcome, durationMs, tool] =
    operations[(sequence - 1) % operations.length];
  const start = BigInt(Date.parse(startedAt)) * 1_000_000n;
  const end =
    durationMs == null
      ? undefined
      : String(start + BigInt(durationMs) * 1_000_000n);
  const root = {
    spanId: "root",
    name: label,
    startTimeNs: String(start),
    endTimeNs: end,
    statusCode: outcome === "error" ? 2 : outcome === "complete" ? 1 : 0,
    statusMessage:
      outcome === "error" ? "The tool request was denied." : undefined,
    attributes: { "agent.name": agentId, "sample.data": true },
  };
  const spans =
    outcome === "unknown"
      ? [root]
      : [
          root,
          {
            spanId: "model",
            parentSpanId: "root",
            name: "Model call",
            startTimeNs: String(start),
            endTimeNs: String(
              start + BigInt(Math.floor(durationMs * 0.4)) * 1_000_000n,
            ),
            statusCode: 1,
            attributes: { model: "sample-model" },
          },
          {
            spanId: "tool",
            parentSpanId: "root",
            name: tool,
            startTimeNs: String(
              start + BigInt(Math.floor(durationMs * 0.4)) * 1_000_000n,
            ),
            endTimeNs: end,
            statusCode: outcome === "error" ? 2 : 1,
            statusMessage:
              outcome === "error" ? "Permission denied (sample)." : undefined,
            attributes: { "tool.name": tool, "sample.data": true },
          },
        ];
  const toolNames = [
    "read_logs",
    "search_docs",
    "read_logs",
    "read_config",
    "read_logs",
    "read_logs",
    "read_context",
    "search_docs",
    "read_environment",
    undefined,
    "search_traces",
    "read_config",
  ];
  const index = (sequence - 1) % operations.length;
  const contentCaptured = index !== 8;
  const input =
    index === 0 ? "Please deploy preview and inspect the logs" : label;
  root.attributes["agent.run.id"] =
    `staging-${agentId}-${index === 3 ? 0 : index}`;
  if (contentCaptured) root.attributes["agent.channel.delivery.input"] = input;
  if (spans[1]) {
    spans[1].attributes["gen_ai.operation.name"] = "chat";
    if (contentCaptured) {
      spans[1].attributes["gen_ai.input.messages"] = JSON.stringify([
        {
          role: "user",
          content:
            index === 4
              ? "Earlier request: Please deploy preview and inspect the logs"
              : input,
        },
      ]);
      spans[1].attributes["gen_ai.output.messages"] =
        "The sample inspection is complete.";
    }
  }
  if (spans[2]) {
    spans[2].attributes["gen_ai.tool.name"] = toolNames[index];
    spans[2].attributes["gen_ai.operation.name"] = "execute_tool";
    if (contentCaptured) {
      spans[2].attributes["gen_ai.tool.call.arguments"] = JSON.stringify({
        environment: "preview",
      });
      if (spans[2].statusCode !== 2)
        spans[2].attributes["gen_ai.tool.call.result"] = JSON.stringify({
          message:
            index === 2
              ? "Recovered from ECONNRESET while checking /api/orders"
              : "Inspection completed; no new issues found.",
        });
    }
  }
  // A successful read and unrelated failed publish distinguish the two error scopes.
  if (index === 5) {
    spans[2].statusCode = 0;
    delete spans[2].statusMessage;
    spans[2].attributes["gen_ai.tool.call.result"] = JSON.stringify({
      message: "Recovered from ECONNRESET; deployment logs are available.",
    });
    spans.push({
      ...spans[2],
      spanId: "publish",
      name: "Publish release",
      statusCode: 2,
      statusMessage: "Permission denied: publish_release (sample).",
      attributes: {
        "gen_ai.tool.name": "publish_release",
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.call.arguments": "{}",
      },
    });
  }
  return {
    traceId: sequence.toString(16).padStart(32, "0"),
    agentId,
    contentCaptured,
    sessionIds: [root.attributes["agent.run.id"]],
    agentNames: [agentId],
    label,
    startedAt,
    durationMs,
    complete: outcome !== "unknown",
    errorSpanCount: outcome === "error" ? 2 : 0,
    modelCalls: outcome === "unknown" ? undefined : 1,
    toolCalls: outcome === "unknown" ? undefined : index === 5 ? 2 : 1,
    spanCount: spans.length,
    spans,
  };
}

export const previewTraces = operations.map((_, index) =>
  createSampleTrace(
    index + 1,
    new Date(Date.parse("2026-11-16T18:42:08Z") - index * 73_000).toISOString(),
  ),
);
