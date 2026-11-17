import React from "react";
import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "./HomePage";
import { previewAgents, previewTraces } from "./previewData";

const props = {
  agents: previewAgents,
  traces: previewTraces,
  workspaceName: "Staging workspace",
  dataLabel: "Staging · simulated data",
};

test("starts on all agents’ traces and searches across operations, agents and IDs", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Traces" }),
  ).toBeVisible();
  expect(screen.getByText("Staging · simulated data")).toBeVisible();
  expect(screen.getByRole("button", { name: "All agents" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("status")).toHaveTextContent("12 traces");
  const search = screen.getByRole("combobox", { name: "Search traces" });
  await user.type(search, "rollback");
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: /Verify the rollback configuration/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Investigate deployment failure" }),
  ).toBeNull();
  await user.clear(search);
  await user.type(search, "research");
  await user.keyboard("{Escape}");
  expect(screen.getByRole("status")).toHaveTextContent("4 traces");
  await user.clear(search);
  await user.type(search, previewTraces[0].traceId);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("status")).toHaveTextContent("1 trace");
});

test("combines agent scope with search filters and can recover from no results", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} />);
  await user.click(
    screen.getByRole("button", { name: "Support", exact: true }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("4 traces · Support");
  const search = screen.getByRole("combobox", { name: "Search traces" });
  expect(screen.queryByRole("combobox", { name: "Outcome" })).toBeNull();
  await user.type(search, "has:error{Enter}");
  expect(screen.getByRole("status")).toHaveTextContent("1 trace · Support");
  expect(
    screen.getByRole("button", { name: /Investigate deployment failure/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Prepare an incident response" }),
  ).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Remove has:error filter" }),
  );
  expect(search).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("4 traces · Support");
  await user.type(
    screen.getByRole("combobox", { name: "Search traces" }),
    "not a recorded operation",
  );
  await user.keyboard("{Escape}");
  expect(screen.getByText("No traces match these filters.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Reset view" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "12 traces · All agents",
  );
  expect(screen.getByRole("combobox", { name: "Search traces" })).toHaveValue(
    "",
  );
});

test("opens captured spans without leaving the results and restores focus on close", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} />);
  const trigger = screen.getByRole("button", {
    name: "Investigate deployment failure",
  });
  await user.click(trigger);
  const inspector = screen.getByRole("complementary", {
    name: "Execution inspector",
  });
  expect(inspector).toHaveFocus();
  expect(screen.getByRole("table", { name: "Recorded traces" })).toBeVisible();
  await user.click(
    within(inspector).getByRole("treeitem", { name: "Read deployment logs" }),
  );
  expect(
    within(inspector).getByRole("region", { name: "Span details" }),
  ).toHaveTextContent("Permission denied (sample).");
  await user.click(within(inspector).getByRole("tab", { name: "Summary" }));
  expect(
    within(inspector).getByRole("region", { name: "Trace summary" }),
  ).toHaveTextContent(previewTraces[0].traceId);
  await user.click(
    within(inspector).getByRole("button", { name: "Close inspector" }),
  );
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(trigger).toHaveFocus();
});

test("changing scope clears the selected execution rather than inspecting a hidden row", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} />);
  await user.click(
    screen.getByRole("button", { name: "Investigate deployment failure" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Research", exact: true }),
  );
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(
    screen.getByRole("button", {
      name: "Find references for the retry policy",
    }),
  ).toBeVisible();
});

test("removing a trace from the data clears selection even if the trace later returns", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<HomePage {...props} />);
  await user.click(
    screen.getByRole("button", { name: "Investigate deployment failure" }),
  );
  rerender(<HomePage {...props} traces={previewTraces.slice(1)} />);
  expect(screen.queryByRole("complementary")).toBeNull();
  rerender(<HomePage {...props} />);
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("sorts missing durations last in both directions and distinguishes empty/loading/error states", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<HomePage {...props} />);
  const rows = () =>
    within(screen.getByRole("table", { name: "Recorded traces" }))
      .getAllByRole("row")
      .slice(1);
  await user.click(
    screen.getByRole("button", { name: "Duration", exact: true }),
  );
  expect(rows().at(-1)).toHaveTextContent("Prepare an incident response");
  await user.click(
    screen.getByRole("button", { name: "Duration", exact: true }),
  );
  expect(rows().at(-1)).toHaveTextContent("Prepare an incident response");
  rerender(<HomePage {...props} traces={[]} />);
  expect(screen.getByText("No recorded traces yet.")).toBeVisible();
  rerender(<HomePage {...props} traces={[]} loading />);
  expect(screen.getByText("Loading results…")).toBeVisible();
  expect(screen.queryByText("No recorded traces yet.")).toBeNull();
  const retry = vi.fn();
  rerender(
    <HomePage
      {...props}
      traces={[]}
      error="Trace storage unavailable"
      onRefresh={retry}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

test("structured search explains a match, opens its span and removes query filters", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} initialQuery={'output:"ECONNRESET"'} />);
  expect(screen.getByRole("status")).toHaveTextContent("2 traces");
  const operation = screen.getByRole("button", {
    name: /Check production deployment health/,
  });
  expect(operation).toHaveAccessibleName(expect.stringContaining("output"));
  await user.click(operation);
  const inspector = screen.getByRole("complementary");
  expect(
    within(inspector).getByRole("treeitem", { name: "Read deployment status" }),
  ).toHaveAttribute("aria-selected", "true");
  const evidence = within(inspector).getByRole("region", {
    name: "Search match evidence",
  });
  expect(evidence).toHaveTextContent("gen_ai.tool.call.result");
  expect(evidence.querySelector("mark")).toHaveTextContent("ECONNRESET");
  await user.click(
    within(inspector).getByRole("button", { name: "Close inspector" }),
  );
  expect(operation).toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: 'Remove output:"ECONNRESET" filter' }),
  );
  expect(screen.getByRole("combobox", { name: "Search traces" })).toHaveValue(
    "",
  );
  expect(screen.getByRole("status")).toHaveTextContent("12 traces");
});

test("query errors are recoverable and history search explicitly includes copied input", async () => {
  const user = userEvent.setup();
  render(<HomePage {...props} initialQuery="duration:soon" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Use a duration");
  expect(screen.queryByRole("table")).toBeNull();
  const input = screen.getByRole("combobox", { name: "Search traces" });
  await user.clear(input);
  await user.type(input, 'context:"deploy preview"');
  await user.keyboard("{Enter}");
  expect(screen.getByRole("status")).toHaveTextContent("2 traces");
  expect(screen.getByText(/has no captured content/)).toBeVisible();
  await user.clear(input);
  await user.click(input);
  expect(
    screen.getByRole("option", {
      name: /context:"deploy preview" Recent search/,
    }),
  ).toBeVisible();
});
