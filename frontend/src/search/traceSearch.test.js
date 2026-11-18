import { test, expect } from "vitest";
import { previewTraces } from "../pages/HomePage/previewData";
import {
  parseTraceQuery,
  searchTraces,
  removeQueryToken,
  searchSuggestions,
} from "./traceSearch";
const find = (query) => searchTraces(previewTraces, parseTraceQuery(query));
test("completes summary metadata and retained catalog values without captured spans or matching rows", () => {
  const summaries = [
    { agentId: "support", agentNames: ["Helper"], toolNames: ["read_logs"] },
  ];
  expect(
    searchSuggestions("tool:rea", summaries).map((item) => item.query),
  ).toContain("tool:read_logs");
  expect(
    searchSuggestions("agent:Hel", summaries).map((item) => item.query),
  ).toContain("agent:Helper");
  expect(
    searchSuggestions("tool:", [], [], { tools: ["read_logs"] }).map(
      (item) => item.query,
    ),
  ).toContain("tool:read_logs");
  expect(
    searchSuggestions("agent:", [], [], { agents: ["support"] }).map(
      (item) => item.query,
    ),
  ).toContain("agent:support");
  const [suggestion] = searchSuggestions("agent:", [], [], {
    agents: ['Support "helper"'],
  });
  expect(parseTraceQuery(suggestion.query)).toMatchObject({
    tokens: [{ field: "agent", value: 'Support "helper"' }],
  });
});
test("searches recorded strings literally without JSON coercion", () => {
  const trace = {
    traceId: "literal-values",
    spans: [
      {
        spanId: "tool",
        name: "Lookup",
        attributes: {
          "gen_ai.tool.name": "lookup",
          "gen_ai.tool.call.result": JSON.stringify({
            keyword: "null",
            invoice: "1234567890123456789",
            notation: "1e3",
          }),
        },
      },
    ],
  };
  for (const query of [
    "output:null",
    "output:1234567890123456789",
    "output:1e3",
  ])
    expect(searchTraces([trace], parseTraceQuery(query))).toHaveLength(1);
  for (const query of ["output:1234567890123456800", "output:1000"])
    expect(searchTraces([trace], parseTraceQuery(query))).toHaveLength(0);
});
test("binds tool status to the named operation, while has:error is trace wide", () => {
  const failed = find("tool:read_logs tool.status:error");
  const any = find("tool:read_logs has:error");
  expect(failed.map((r) => r.trace.label)).toEqual([
    "Investigate deployment failure",
  ]);
  expect(any.map((r) => r.trace.label)).toEqual([
    "Investigate deployment failure",
    "Validate release permissions",
  ]);
  expect(failed[0].matches.some((m) => m.spanId === "tool")).toBe(true);
});
test("keeps original input distinct from repeated prompt context", () => {
  expect(find('input:"deploy preview"')).toHaveLength(1);
  expect(find('context:"deploy preview"')).toHaveLength(2);
  expect(find('"deploy preview"')).toHaveLength(1);
});
test("returns original output provenance and binds output to a selected tool", () => {
  const results = find('tool:read_logs output:"ECONNRESET"');
  expect(results).toHaveLength(2);
  expect(
    results.every(
      (r) =>
        r.matches[0].field === "output" &&
        r.matches[0].spanId === "tool" &&
        r.matches[0].source === "gen_ai.tool.call.result",
    ),
  ).toBe(true);
  expect(find('tool:publish_release output:"ECONNRESET"')).toHaveLength(0);
});
test("metadata remains searchable without content and missing timings cannot match a range", () => {
  expect(
    find("agent:release").some((r) => r.trace.contentCaptured === false),
  ).toBe(true);
  expect(find('input:"staging environment"')).toHaveLength(0);
  expect(find("agent:research duration:>3s")).toHaveLength(3);
  expect(
    find("duration:>=0ms").some((r) => r.trace.durationMs === undefined),
  ).toBe(false);
  expect(find(`session:${previewTraces[0].sessionIds[0]}`)).toHaveLength(2);
  expect(find(`trace:${previewTraces[0].traceId}`)).toHaveLength(1);
});
test("validates incomplete phrases, unknown fields and duration units", () => {
  for (const query of [
    'input:"open',
    "tool:",
    "duration:soon",
    "duration:>3",
    "has:success",
    "status:error",
  ])
    expect(parseTraceQuery(query).error).toBeTruthy();
  expect(parseTraceQuery('input:"deploy \\"preview\\""').error).toBeUndefined();
  expect(searchTraces(previewTraces, parseTraceQuery("tool:"))).toEqual([]);
});
test("removes just the selected token and suggests values without replacing earlier filters", () => {
  const query = 'agent:release output:"hello world" tool:read_logs';
  expect(removeQueryToken(query, parseTraceQuery(query).tokens[1])).toBe(
    "agent:release tool:read_logs",
  );
  expect(
    searchSuggestions("agent:release tool:rea", previewTraces).some(
      (item) => item.query === "agent:release tool:read_logs",
    ),
  ).toBe(true);
  expect(searchSuggestions("", previewTraces, ["agent:release"])[0]).toEqual({
    query: "agent:release",
    description: "Recent search",
  });
});

test("colons inside quoted text stay literal and comparison filters compose", () => {
  expect(parseTraceQuery('"https://example.com/api"').tokens[0]).toMatchObject({
    field: "text",
    value: "https://example.com/api",
  });
  expect(parseTraceQuery('output:"Error: denied"').tokens[0]).toMatchObject({
    field: "output",
    value: "Error: denied",
  });
  expect(find("duration:>=1s duration:<2s")).toHaveLength(2);
});

test("staging shares payload leaf boundaries and correlates repeated tool calls", () => {
  const trace = {
    traceId: "repeat",
    agentId: "support",
    spans: [
      {
        spanId: "a",
        name: "First",
        attributes: {
          "gen_ai.tool.name": "repeat",
          "gen_ai.tool.call.result": JSON.stringify({
            message: "ONLY_FIRST",
            other: "separate value",
          }),
        },
      },
      {
        spanId: "b",
        name: "Second",
        attributes: {
          "gen_ai.tool.name": "repeat",
          "gen_ai.tool.call.result": JSON.stringify({ message: "ONLY_SECOND" }),
        },
      },
    ],
  };
  expect(
    searchTraces(
      [trace],
      parseTraceQuery("tool:repeat output:ONLY_FIRST output:ONLY_SECOND"),
    ),
  ).toHaveLength(0);
  expect(
    searchTraces([trace], parseTraceQuery('output:"ONLY_FIRST separate"')),
  ).toHaveLength(0);
  expect(searchTraces([trace], parseTraceQuery("output:message"))).toHaveLength(
    0,
  );
});
