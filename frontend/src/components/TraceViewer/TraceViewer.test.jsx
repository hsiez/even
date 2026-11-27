import React from "react";
import { test, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceViewer } from "./TraceViewer";
import {
  viewerTrace,
  partialViewerTrace,
} from "../../test/traceViewerFixtures";
const raw = (scope = screen) =>
  JSON.parse(
    scope.getByRole("region", { name: "raw span JSON content" }).textContent,
  );

test("restores both scroll axes per scope and span without resetting ordinary selection", async () => {
  const user = userEvent.setup();
  const { container, rerender } = render(<TraceViewer trace={viewerTrace} />);
  const path = () => container.querySelector('[data-trace-surface="path"]');
  const content = () =>
    screen.getByRole("region", { name: "raw span JSON content" });
  fireEvent.scroll(path(), { target: { scrollTop: 140, scrollLeft: 12 } });
  fireEvent.scroll(content(), { target: { scrollTop: 90, scrollLeft: 24 } });
  await user.click(screen.getByRole("treeitem", { name: "Tool read_logs" }));
  expect(path().scrollTop).toBe(140);
  expect(path().scrollLeft).toBe(12);
  expect(content().scrollTop).toBe(0);
  await user.click(screen.getByRole("treeitem", { name: "Step 0" }));
  expect(content().scrollTop).toBe(90);
  expect(content().scrollLeft).toBe(24);
  await user.click(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  );
  expect(path().scrollTop).toBe(0);
  fireEvent.scroll(path(), { target: { scrollTop: 60, scrollLeft: 8 } });
  await user.click(screen.getByRole("button", { name: "Back to Support" }));
  expect(path().scrollTop).toBe(140);
  expect(path().scrollLeft).toBe(12);
  expect(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  ).toHaveFocus();
  await user.click(screen.getByRole("treeitem", { name: "Step 0" }));
  rerender(<TraceViewer trace={viewerTrace} loading />);
  expect(screen.queryByRole("treeitem")).toBeNull();
  fireEvent.scroll(path(), { target: { scrollTop: 0, scrollLeft: 0 } });
  rerender(<TraceViewer trace={viewerTrace} />);
  expect(path().scrollTop).toBe(140);
  expect(content().scrollTop).toBe(90);
  expect(content().scrollLeft).toBe(24);
});
test("selection shows the full original span, entering children changes scope and breadcrumbs restore state", async () => {
  const user = userEvent.setup();
  render(<TraceViewer trace={viewerTrace} defaultSelectedSpanId="logs" />);
  expect(raw()).toEqual(
    viewerTrace.spans.find((span) => span.spanId === "logs"),
  );

  expect(screen.queryByRole("treeitem", { name: /^Tool search\b/ })).toBeNull();
  await user.click(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  );
  expect(
    screen.getByText("Research", { selector: '[aria-current="location"]' }),
  ).toBeVisible();
  expect(raw().spanId).toBe("research-step");
  expect(screen.getByRole("treeitem", { name: /^Step 0\b/ })).toHaveFocus();
  await user.click(
    screen.getByRole("treeitem", { name: /^Subagent Source checking\b/ }),
  );
  expect(
    screen.getByRole("treeitem", { name: /^Tool search\b/ }),
  ).toBeVisible();
  expect(screen.getByRole("navigation")).toHaveTextContent(
    "Support/Research/Source checking",
  );
  await user.click(
    screen.getByRole("button", { name: "Support", exact: true }),
  );
  expect(raw().spanId).toBe("research");
  expect(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  ).toHaveFocus();
});
test("instances are independent and a different trace resets the navigation history", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <>
      <TraceViewer trace={viewerTrace} />
      <TraceViewer trace={viewerTrace} />
    </>,
  );
  const [first, second] = screen
    .getAllByRole("region", { name: "Trace viewer" })
    .map((node) => within(node));
  await user.click(
    first.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  );
  expect(raw(first).spanId).toBe("research-step");
  expect(raw(second).spanId).toBe("step-0");
  rerender(<TraceViewer trace={partialViewerTrace} />);
  expect(screen.getAllByRole("treeitem")).toHaveLength(3);
  expect(raw().spanId).toBe("orphan");
});
test("keyboard can drill into a child and generic spans retain raw fields", async () => {
  const user = userEvent.setup();
  render(<TraceViewer trace={viewerTrace} />);
  const child = screen.getByRole("treeitem", { name: /^Subagent Research\b/ });
  child.focus();
  await user.keyboard("{Enter}");
  expect(raw().spanId).toBe("research-step");
  await user.click(
    screen.getByRole("button", { name: "Support", exact: true }),
  );
  await user.click(
    screen.getByRole("treeitem", { name: /^Span custom\.cache\.inspect\b/ }),
  );
  expect(raw().attributes["cache.hit"]).toBe(false);
});

test("the activation lives in the breadcrumb and remains inspectable as original JSON", async () => {
  const user = userEvent.setup();
  render(<TraceViewer trace={viewerTrace} />);
  expect(screen.queryByRole("treeitem", { name: /^Support\b/ })).toBeNull();
  expect(screen.getAllByRole("treeitem")[0]).toHaveTextContent("Step 0");
  expect(raw().spanId).toBe("step-0");
  await user.click(
    screen.getByRole("button", { name: "Support", exact: true }),
  );
  expect(raw()).toEqual(
    viewerTrace.spans.find((span) => span.spanId === "support"),
  );
});
test("back restores the entered subagent as the selected parent row and announces the scope", async () => {
  const user = userEvent.setup();
  render(<TraceViewer trace={viewerTrace} />);
  await user.click(
    screen.getByRole("treeitem", { name: /^Subagent Research\b/ }),
  );
  expect(screen.getByText("Viewing Research execution")).toHaveAttribute(
    "role",
    "status",
  );
  await user.click(screen.getByRole("button", { name: "Back to Support" }));
  const row = screen.getByRole("treeitem", { name: /^Subagent Research\b/ });
  expect(row).toHaveFocus();
  expect(row).toHaveAttribute("aria-selected", "true");
  expect(raw().spanId).toBe("research");
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Back to Support" })).toBeVisible();
  expect(raw().spanId).toBe("research-step");
});
test("keeps the explorer to type/name while the data header follows selection with aggregated step usage", async () => {
  const user = userEvent.setup();
  render(<TraceViewer trace={viewerTrace} />);
  expect(screen.getByRole("treeitem", { name: "Step 0" })).toHaveTextContent(
    /^Step 0$/,
  );
  expect(
    screen.getByRole("group", { name: "Selected span metrics" }),
  ).toHaveTextContent("1.50 s 170 tokens");
  await user.click(screen.getByRole("treeitem", { name: "Tool read_logs" }));
  expect(
    screen.getByRole("group", { name: "Selected span metrics" }),
  ).toHaveTextContent(/^420 ms$/);
});
