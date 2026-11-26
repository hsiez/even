import { test, expect } from "vitest";
import {
  describeSpan,
  pathSpans,
  traceScopes,
  traceTokenUsage,
} from "./traceModel";
import { viewerTrace } from "../test/traceViewerFixtures";
test("only recorded activation descendants form breadcrumb ancestry; dispatch spans remain inspectable", () => {
  const model = traceScopes(viewerTrace.spans);
  expect(model.scopes.get("source").path.map((span) => span.spanId)).toEqual([
    "support",
    "research",
    "source",
  ]);
  const root = model.scopeSpans("support");
  expect(root.map((span) => span.spanId)).toContain("research");
  expect(root.map((span) => span.spanId)).not.toContain("research-model");
  expect(root.find((span) => span.spanId === "logs")).toBe(
    viewerTrace.spans.find((span) => span.spanId === "logs"),
  );
  expect(describeSpan(root.find((span) => span.spanId === "dispatch"))).toEqual(
    { kind: "Delegation", label: "Delegate to Research" },
  );
});
test("caller-role invoke spans and unknown schema fields do not invent child activations", () => {
  const span = {
    spanId: "future",
    name: "future.operation",
    attributes: {
      "gen_ai.operation.name": "invoke_agent",
      "agent.invocation.role": "caller",
      "new.field": true,
    },
  };
  const model = traceScopes([span]);
  expect(model.scopes.size).toBe(0);
  expect(model.scopeSpans().map((span) => span.spanId)).toEqual(["future"]);
  expect(describeSpan(span).kind).toBe("Span");
});

test("an available root activation does not hide spans whose parent is missing", () => {
  const orphan = {
    spanId: "orphan",
    parentSpanId: "missing",
    name: "unowned.operation",
    attributes: {},
  };
  const model = traceScopes([...viewerTrace.spans, orphan]);
  expect(model.scopeSpans(model.initial)).toContain(orphan);
  expect(model.scopeSpans("research")).not.toContain(orphan);
});
test("only the current activation leaves the path; missing steps and unknown operations remain inspectable", () => {
  const scoped = traceScopes(viewerTrace.spans).scopeSpans("support");
  const visible = pathSpans(scoped, "support");
  expect(visible[0].spanId).toBe("step-0");
  expect(visible.some((span) => span.spanId === "research")).toBe(true);
  expect(visible.find((span) => span.spanId === "logs")).toBe(
    viewerTrace.spans.find((span) => span.spanId === "logs"),
  );
  expect(
    pathSpans([{ spanId: "custom", name: "future.operation" }], "support"),
  ).toHaveLength(1);
});
test("step tokens count outer model usage once, exclude child activations and preserve unknowns", () => {
  const duplicate = {
    spanId: "sdk",
    parentSpanId: "model-0",
    name: "SDK chat",
    attributes: {
      "gen_ai.operation.name": "chat",
      "gen_ai.usage.input_tokens": 128,
      "gen_ai.usage.output_tokens": 42,
    },
  };
  const usage = traceTokenUsage([...viewerTrace.spans, duplicate]);
  expect(usage.get("step-0")).toEqual({ count: 170, partial: false });
  expect(usage.get("model-0")).toEqual({ count: 170, partial: false });
  expect(usage.get("logs")).toBeUndefined();
  expect(usage.get("source-step")).toBeUndefined();
});
test("partial model usage uses lower bounds and invalid values never masquerade as tokens", () => {
  const spans = [
    { spanId: "step", name: "agent.step" },
    {
      spanId: "model",
      parentSpanId: "step",
      name: "chat",
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.usage.input_tokens": "128",
      },
    },
    {
      spanId: "unknown",
      parentSpanId: "step",
      name: "chat",
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.usage.output_tokens": -1,
      },
    },
  ];
  expect(traceTokenUsage(spans).get("step")).toEqual({
    count: 128,
    partial: true,
  });
  spans[1].attributes["gen_ai.usage.input_tokens"] = 0;
  spans[1].attributes["gen_ai.usage.output_tokens"] = 0;
  expect(traceTokenUsage(spans).get("model")).toEqual({
    count: 0,
    partial: false,
  });
});
test("explicit step usage is authoritative and never added to descendant usage", () => {
  const spans = viewerTrace.spans.map((span) =>
    span.spanId === "step-0"
      ? {
          ...span,
          attributes: {
            ...span.attributes,
            "gen_ai.usage.input_tokens": 100,
            "gen_ai.usage.output_tokens": 20,
          },
        }
      : span,
  );
  expect(traceTokenUsage(spans).get("step-0")).toEqual({
    count: 120,
    partial: false,
  });
});
