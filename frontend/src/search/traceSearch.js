import { searchContent } from "../../../src/search/content.js";
import { parseTraceQuery } from "../../../src/search/query.js";
export {
  parseTraceQuery,
  removeQueryToken,
  matchExcerpt,
} from "../../../src/search/query.js";
// Staging view-model matcher. Backend ingestion uses Eve's canonical helpers.
const textFields = new Set(["input", "output", "context", "reply", "error"]);
const lower = (value) => String(value ?? "").toLowerCase();
const contains = (value, term) => lower(value).includes(lower(term));

export function traceDocuments(trace) {
  return (trace.spans ?? []).flatMap((span) => {
    const attrs = span.attributes ?? {};
    const mappings = [
      ["input", "agent.channel.delivery.input"],
      ["output", "gen_ai.tool.call.result"],
      ["context", "gen_ai.input.messages"],
      ["reply", "gen_ai.output.messages"],
      ["arguments", "gen_ai.tool.call.arguments"],
    ];
    const documents = mappings
      .filter(([, source]) => attrs[source] !== undefined)
      .flatMap(([field, source]) =>
        searchContent(
          attrs[source],
          "$",
          0,
          field === "context" || field === "reply",
        ).map((leaf) => ({
          ...leaf,
          field,
          source,
          spanId: span.spanId,
          operation: span.name,
        })),
      );
    if (span.statusMessage)
      documents.push({
        field: "error",
        source: "statusMessage",
        spanId: span.spanId,
        operation: span.name,
        text: span.statusMessage,
      });
    for (const [eventIndex, event] of (span.events ?? []).entries()) {
      for (const source of ["exception.message", "exception.stacktrace"]) {
        if (typeof event.attributes?.[source] === "string")
          documents.push({
            field: "error",
            text: event.attributes[source],
            spanId: span.spanId,
            operation: span.name,
            source: `events[${eventIndex}].${source}`,
            eventIndex,
          });
      }
    }
    return documents;
  });
}

const toolName = (span) =>
  span.attributes?.["gen_ai.tool.name"] ?? span.attributes?.["tool.name"];
const durationMatches = (value, { operator, ms }) =>
  Number.isFinite(value) &&
  value >= 0 &&
  {
    ">": () => value > ms,
    ">=": () => value >= ms,
    "<": () => value < ms,
    "<=": () => value <= ms,
    "=": () => value === ms,
  }[operator]();

export function searchTraces(traces, parsed) {
  if (parsed.error) return [];
  return traces.flatMap((trace) => {
    const tokens = parsed.tokens;
    const toolTokens = tokens.filter((token) => token.field === "tool");
    const failedTool = tokens.some((token) => token.field === "tool.status");
    const documents = traceDocuments(trace);
    const scopedTools = (trace.spans ?? []).filter(
      (span) =>
        toolName(span) &&
        toolTokens.every(
          (token) => lower(toolName(span)) === lower(token.value),
        ) &&
        (!failedTool || span.statusCode === 2) &&
        tokens
          .filter((token) => ["text", "output", "error"].includes(token.field))
          .every(
            (token) =>
              (token.field === "text" &&
                [
                  trace.label,
                  trace.traceId,
                  trace.agentId,
                  ...(trace.agentNames ?? []),
                ].some((value) => contains(value, token.value))) ||
              documents.some(
                (doc) =>
                  (token.field === "text"
                    ? doc.field !== "context"
                    : doc.field === token.field) &&
                  (!["output", "error", "arguments"].includes(doc.field) ||
                    doc.spanId === span.spanId) &&
                  contains(doc.text, token.value),
              ),
          ),
    );
    if ((toolTokens.length || failedTool) && !scopedTools.length) return [];
    const matches = [];
    const metadata = (field, text, term) => ({
      field,
      text: String(text),
      term,
    });
    for (const token of tokens) {
      const { field, value } = token;
      let found = [];
      if (field === "tool" || field === "tool.status")
        found = scopedTools.map((span) => ({
          field: "tool",
          text: `${toolName(span)}${span.statusCode === 2 ? " · recorded error" : ""}`,
          spanId: span.spanId,
          operation: span.name,
          source: field === "tool" ? "gen_ai.tool.name" : "statusCode",
          term: field === "tool" ? value : "recorded error",
        }));
      else if (field === "agent")
        found = [trace.agentId, ...(trace.agentNames ?? [])]
          .filter((name) => lower(name) === lower(value))
          .map((name) => metadata(field, name, value));
      else if (field === "trace")
        found =
          lower(trace.traceId) === lower(value)
            ? [metadata(field, trace.traceId, value)]
            : [];
      else if (field === "session")
        found = (trace.sessionIds ?? [])
          .filter((id) => lower(id) === lower(value))
          .map((id) => metadata(field, id, value));
      else if (field === "duration")
        found = durationMatches(trace.durationMs, token.comparison)
          ? [metadata(field, `${trace.durationMs} ms elapsed`, "")]
          : [];
      else if (field === "has")
        found =
          trace.errorSpanCount > 0
            ? [
                {
                  field: "error",
                  text: "This trace contains recorded errors",
                  spanId: trace.spans?.find((span) => span.statusCode === 2)
                    ?.spanId,
                  term: "recorded errors",
                },
              ]
            : [];
      else {
        found = documents
          .filter(
            (doc) =>
              (field === "text"
                ? doc.field !== "context"
                : doc.field === field) &&
              (!(toolTokens.length || failedTool) ||
                !["output", "error", "arguments"].includes(doc.field) ||
                scopedTools.some((span) => span.spanId === doc.spanId)) &&
              contains(doc.text, value),
          )
          .map((doc) => ({ ...doc, term: value }));
        if (field === "text")
          found.push(
            ...[
              trace.label,
              trace.traceId,
              trace.agentId,
              ...(trace.agentNames ?? []),
            ]
              .filter((text) => contains(text, value))
              .map((text) => metadata("trace", text, value)),
          );
      }
      if (!found.length) return [];
      matches.push(...found);
    }
    // Prefer captured content over structural matches when choosing where to open.
    const unique = [
      ...new Map(
        matches.map((match) => [
          `${match.spanId}:${match.field}:${match.text}`,
          match,
        ]),
      ).values(),
    ];
    unique.sort(
      (a, b) =>
        Number(textFields.has(b.field)) - Number(textFields.has(a.field)) ||
        Number(!!b.spanId) - Number(!!a.spanId),
    );
    return [{ trace, matches: unique }];
  });
}

export function searchSuggestions(query, traces, recent = [], catalog = {}) {
  const examples = [
    {
      query: "tool:read_logs tool.status:error",
      description: "Find a failed read_logs call",
    },
    {
      query: "tool:read_logs has:error",
      description: "Reads in traces with any recorded error",
    },
    {
      query: 'output:"ECONNRESET"',
      description: "Find text in original tool results",
    },
    {
      query: 'input:"deploy preview"',
      description: "Find an incoming message",
    },
    {
      query: "agent:research duration:>3s",
      description: "Find slow Research traces",
    },
    {
      query: 'context:"deploy preview"',
      description: "Include copied conversation history",
    },
  ];
  if (!query.trim())
    return [
      ...recent
        .slice(0, 3)
        .map((value) => ({ query: value, description: "Recent search" })),
      ...examples.filter((item) => !recent.includes(item.query)),
    ];
  const last = /(?:^|\s)([\w.]+):([^\s"]*)$/u.exec(query);
  if (last) {
    const field = last[1],
      prefix = last[2];
    const values = {
      tool: [
        ...new Set([
          ...(catalog.tools ?? []),
          ...traces.flatMap((trace) => [
            ...(trace.toolNames ?? []),
            ...(trace.spans ?? []).map(toolName).filter(Boolean),
          ]),
        ]),
      ],
      agent: [
        ...new Set([
          ...(catalog.agents ?? []),
          ...traces
            .flatMap((trace) => [trace.agentId, ...(trace.agentNames ?? [])])
            .filter(Boolean),
        ]),
      ],
      "tool.status": ["error"],
      has: ["error"],
      duration: [">3s", ">1s", ">=500ms"],
    }[field];
    if (values)
      return values
        .filter((value) => lower(value).startsWith(lower(prefix)))
        .slice(0, 8)
        .map((value) => ({
          query:
            query.slice(0, last.index) +
            (last.index ? " " : "") +
            `${field}:${/[\s"\\]/u.test(value) ? JSON.stringify(value) : value}`,
          description:
            field === "tool.status"
              ? "Error on the selected tool operation"
              : `Filter by ${field}`,
        }));
  }
  return examples.filter((item) =>
    lower(item.query).includes(lower(query.trim())),
  );
}
