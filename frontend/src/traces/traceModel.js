import { spanForest } from "../components/SpanWaterfall/SpanWaterfall";

export function isActivation(span) {
  return (
    span.name === "agent.turn" ||
    (span.attributes?.["gen_ai.operation.name"] === "invoke_agent" &&
      span.attributes?.["agent.invocation.role"] !== "caller")
  );
}
export function describeSpan(span) {
  const attributes = span.attributes ?? {};
  const text = (key) =>
    typeof attributes[key] === "string" ? attributes[key] : undefined;
  if (isActivation(span))
    return {
      kind: "Agent",
      activation: true,
      label:
        text("agent.subagent.name") ??
        text("gen_ai.agent.name") ??
        text("agent.name") ??
        span.name,
    };
  if (span.name === "agent.step")
    return {
      kind:
        attributes["agent.step.attempt"] == null
          ? "Step"
          : `Attempt ${attributes["agent.step.attempt"]}`,
      label:
        attributes["agent.step.index"] == null
          ? span.name
          : `Step ${attributes["agent.step.index"]}`,
    };
  const action = attributes["agent.action.kind"];
  const kind =
    action === "load-skill"
      ? "Skill"
      : ["subagent-call", "remote-agent-call"].includes(action)
        ? "Delegation"
        : attributes["gen_ai.operation.name"] === "chat"
          ? "Model"
          : attributes["gen_ai.operation.name"] === "execute_tool"
            ? "Tool"
            : span.name === "agent.approval"
              ? "Approval"
              : ["search_memory", "upsert_memory"].includes(
                    attributes["gen_ai.operation.name"],
                  )
                ? "Memory"
                : "Span";
  return {
    kind,
    label:
      kind === "Delegation"
        ? `Delegate to ${text("agent.action.name") ?? text("gen_ai.tool.name") ?? span.name}`
        : (text("gen_ai.tool.name") ?? text("agent.action.name") ?? span.name),
  };
}

export function pathSpans(spans, activationId) {
  return spans.filter(
    (span) => span.spanId !== activationId || !isActivation(span),
  );
}

function ownTokenUsage(span) {
  const count = (key) => {
    const value = span.attributes?.[key];
    if (
      typeof value !== "number" &&
      !(typeof value === "string" && /^\d+$/.test(value))
    )
      return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
  };
  const input = count("gen_ai.usage.input_tokens"),
    output = count("gen_ai.usage.output_tokens");
  if (input === undefined && output === undefined) return undefined;
  const total = (input ?? 0) + (output ?? 0);
  return Number.isSafeInteger(total)
    ? { count: total, partial: input === undefined || output === undefined }
    : undefined;
}

export function traceTokenUsage(spans) {
  const nodes = new Map();
  function index(forest) {
    for (const node of forest) {
      nodes.set(node.span.spanId, node);
      index(node.children);
    }
  }
  index(spanForest(spans));
  const memo = new Map();
  function modelUsage(node) {
    if (memo.has(node)) return memo.get(node);
    let records = [];
    if (!isActivation(node.span)) {
      const model = node.span.attributes?.["gen_ai.operation.name"] === "chat";
      const usage = ownTokenUsage(node.span);
      records = usage ? [usage] : node.children.flatMap(modelUsage);
      if (model && !records.length) records = [{ partial: true }];
    }
    memo.set(node, records);
    return records;
  }
  return new Map(
    [...nodes].map(([id, node]) => {
      const own = ownTokenUsage(node.span);
      if (own) return [id, own];
      if (node.span.name !== "agent.step") return [id, undefined];
      const records = node.children.flatMap(modelUsage);
      const known = records.filter((record) => record.count !== undefined);
      const total = known.reduce((sum, record) => sum + record.count, 0);
      return [
        id,
        known.length && Number.isSafeInteger(total)
          ? { count: total, partial: records.some((record) => record.partial) }
          : undefined,
      ];
    }),
  );
}
export function traceScopes(spans) {
  const forest = spanForest(spans);
  const scopes = new Map();
  const owners = new Map();
  function visit(nodes, ancestors = []) {
    for (const node of nodes) {
      const path = isActivation(node.span)
        ? [...ancestors, node.span]
        : ancestors;
      if (isActivation(node.span))
        scopes.set(node.span.spanId, { span: node.span, path, node });
      owners.set(node.span.spanId, path.at(-1)?.spanId);
      visit(node.children, path);
    }
  }
  visit(forest);
  function scopeSpans(id) {
    const result = [];
    const scope = scopes.get(id);
    function collect(nodes) {
      for (const node of nodes) {
        result.push(node.span);
        if (!isActivation(node.span)) collect(node.children);
      }
    }
    if (scope) {
      result.push(scope.span);
      collect(scope.node.children);

      if (id === scopes.keys().next().value)
        for (const span of spans)
          if (!owners.get(span.spanId) && !result.includes(span))
            result.push(span);
    } else collect(forest);
    return result;
  }
  return { scopes, scopeSpans, initial: scopes.keys().next().value };
}
