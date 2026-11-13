import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpanWaterfall } from "./SpanWaterfall";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("separates expansion, keyboard focus and shared selection", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <SpanWaterfall spans={spans} onSelectSpan={select}>
      <SpanWaterfall.Tree />
      <SpanWaterfall.Timeline />
    </SpanWaterfall>,
  );
  await user.tab();
  const root = screen.getByRole("treeitem", { name: "Agent activation" });
  expect(root).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(root).toHaveAttribute("aria-expanded", "true");
  expect(select).not.toHaveBeenCalled();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("treeitem", { name: "Model call" })).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledWith("model");
  expect(screen.getByRole("button", { name: "Model call" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.keyboard("{ArrowLeft}");
  expect(root).toHaveFocus();
});
test("shows orphaned and cyclic spans and calculates nanosecond timing accurately", () => {
  const odd = [
    { ...spans[0], parentSpanId: "model" },
    spans[1],
    { ...spans[2], parentSpanId: "missing" },
  ];
  render(
    <SpanWaterfall spans={odd}>
      <SpanWaterfall.Tree />
      <SpanWaterfall.Timeline />
    </SpanWaterfall>,
  );
  expect(screen.getAllByRole("treeitem")).toHaveLength(3);
  expect(screen.getByText("4.20 s")).toBeVisible();
  expect(screen.getByText("3.20 s")).toBeVisible();
});

test("associates child groups with their parent and keeps selection local to the clicked node", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <SpanWaterfall
      spans={spans}
      defaultExpandedSpanIds={["root"]}
      onSelectSpan={select}
    >
      <SpanWaterfall.Tree />
    </SpanWaterfall>,
  );
  const root = screen.getByRole("treeitem", { name: "Agent activation" });
  const child = screen.getByRole("treeitem", { name: "Model call" });
  expect(root).toHaveAttribute("aria-owns", child.closest('[role="group"]').id);
  await user.click(child);
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith("model");
  await user.click(
    screen.getByRole("button", { name: "Collapse Agent activation" }),
  );
  expect(root).toHaveFocus();
  expect(select).toHaveBeenCalledTimes(1);
});
