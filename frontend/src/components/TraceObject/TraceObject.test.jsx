import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TraceObject } from "./TraceObject";
import { viewerTrace } from "../../test/traceViewerFixtures";
const step = viewerTrace.spans.find((span) => span.spanId === "step-0");
test("shows the step title without repeating the type or displaying metrics", () => {
  const { container } = render(<TraceObject span={step} />);
  expect(screen.getByText("Step 0")).toBeVisible();
  expect(screen.queryByText("1.50 s")).toBeNull();
  expect(screen.queryByText("170 tokens")).toBeNull();
  expect(screen.queryByText("Step", { exact: true })).toBeNull();
  expect(container.querySelector("svg")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
});
test("names categories directly, keeps tool operations under Tool, and permits an explicit subagent context", () => {
  const { rerender } = render(
    <TraceObject
      span={viewerTrace.spans.find((span) => span.spanId === "model-0")}
    />,
  );
  expect(screen.getByText("Model", { exact: true })).toBeVisible();
  for (const name of [
    "read_file",
    "write_file",
    "search_files",
    "future_tool",
  ]) {
    rerender(
      <TraceObject
        span={{
          name: `execute_tool ${name}`,
          attributes: {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": name,
          },
        }}
      />,
    );
    expect(screen.getByText("Tool", { exact: true })).toBeVisible();
    expect(screen.getByText(name)).toBeVisible();
  }
  for (const [id, category] of [
    ["skill", "Skill"],
    ["dispatch", "Delegation"],
    ["custom", "Span"],
    ["research", "Agent"],
  ]) {
    rerender(
      <TraceObject
        span={viewerTrace.spans.find((span) => span.spanId === id)}
      />,
    );
    expect(screen.getByText(category, { exact: true })).toBeVisible();
  }
  rerender(
    <TraceObject
      span={viewerTrace.spans.find((span) => span.spanId === "research")}
      category="Subagent"
    />,
  );
  expect(screen.getByText("Subagent", { exact: true })).toBeVisible();
});
