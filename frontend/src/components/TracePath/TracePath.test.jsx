import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TracePath } from "./TracePath";
import {
  rootPathSpans,
  partialViewerTrace,
} from "../../test/traceViewerFixtures";
test("reuses tree navigation and separates expansion, focus and selection", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(<TracePath spans={rootPathSpans} onSelectSpan={select} />);
  expect(screen.queryByRole("heading", { name: "Execution path" })).toBeNull();
  await user.tab();
  expect(screen.queryByRole("treeitem", { name: /^Support\b/ })).toBeNull();
  expect(screen.getByRole("treeitem", { name: /^Step 0\b/ })).toHaveFocus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(
    screen.getByRole("treeitem", { name: /^Model chat fixture-model\b/ }),
  ).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledWith("model-0");
});
test("keeps unfamiliar, missing-parent and cyclic operations inspectable", () => {
  render(<TracePath spans={partialViewerTrace.spans} />);
  expect(screen.getAllByRole("treeitem")).toHaveLength(3);
  expect(
    screen.getByRole("treeitem", { name: /^Span custom\.incomplete\b/ }),
  ).toBeVisible();
});
test("empty path explains the missing data", () => {
  render(<TracePath />);
  expect(screen.getByText("No spans recorded.")).toBeVisible();
});
test("the neutral marker toggles a branch without a separate plus/minus or selecting a different span", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <TracePath
      spans={rootPathSpans}
      defaultExpandedSpanIds={["step-0"]}
      defaultSelectedSpanId="logs"
      onSelectSpan={select}
    />,
  );
  const toggle = screen.getByRole("button", { name: "Collapse Step 0" });
  expect(toggle).not.toHaveTextContent(/[+−]/);
  expect(toggle.querySelector(".even-trace-path-marker")).not.toBeNull();
  await user.click(toggle);
  expect(screen.getByRole("treeitem", { name: /^Step 0\b/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(select).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Expand Step 0" }));
  expect(
    screen.getByRole("treeitem", { name: /^Tool read_logs\b/ }),
  ).toHaveAttribute("aria-selected", "true");
});
test("every visible operation has one neutral station and leaf stations select their record", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <TracePath
      spans={rootPathSpans}
      defaultExpandedSpanIds={["step-0", "dispatch", "step-1"]}
      onSelectSpan={select}
    />,
  );
  for (const row of screen.getAllByRole("treeitem")) {
    expect(row.querySelectorAll(".even-trace-path-node")).toHaveLength(1);
    expect(row.querySelector(".even-trace-path-node")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
  const read = screen.getByRole("treeitem", { name: /^Tool read_logs\b/ });
  await user.click(read.querySelector(".even-trace-path-node"));
  expect(select).toHaveBeenCalledWith("logs");
  expect(read).toHaveFocus();
});
test("an activation inside an ordinary operation is retained when no current activation is supplied", () => {
  render(
    <TracePath
      spans={[
        { spanId: "custom-root", name: "custom.workflow" },
        {
          spanId: "child",
          parentSpanId: "custom-root",
          name: "invoke_agent Research",
          attributes: {
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.agent.name": "Research",
          },
        },
      ]}
      defaultExpandedSpanIds={["custom-root"]}
    />,
  );
  expect(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  ).toBeVisible();
});
