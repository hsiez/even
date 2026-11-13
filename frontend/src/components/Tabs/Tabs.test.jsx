import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("coordinates keyboard selection, exposes disabled tabs without activating them, and links panels", async () => {
  const user = userEvent.setup();
  render(
    <Tabs defaultValue="a">
      <Tabs.List label="Sections">
        <Tabs.Trigger value="a">A</Tabs.Trigger>
        <Tabs.Trigger value="b" disabled>
          B
        </Tabs.Trigger>
        <Tabs.Trigger value="c">C</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="a">Alpha</Tabs.Panel>
      <Tabs.Panel value="c">Charlie</Tabs.Panel>
    </Tabs>,
  );
  await user.tab();
  expect(screen.getByRole("tab", { name: "A" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "C" })).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Charlie");
  expect(
    screen.getByRole("tab", { name: "C" }).getAttribute("aria-controls"),
  ).toBe(screen.getByRole("tabpanel").id);
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: "C" })).toHaveFocus();
});

test("controlled vertical tabs request updates without changing another instance", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  const example = (label, value, onValueChange) => (
    <Tabs value={value} onValueChange={onValueChange} orientation="vertical">
      <Tabs.List label={label}>
        <Tabs.Trigger value="a">A</Tabs.Trigger>
        <Tabs.Trigger value="b">B</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="a">Alpha</Tabs.Panel>
      <Tabs.Panel value="b">Beta</Tabs.Panel>
    </Tabs>
  );
  render(
    <>
      {example("First", "a", change)}
      {example("Second", "b", () => {})}
    </>,
  );
  await user.tab();
  await user.keyboard("{ArrowDown}");
  expect(change).toHaveBeenCalledWith("b", expect.any(Object));
  expect(screen.getAllByRole("tab", { name: "A" })[0]).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getAllByRole("tab", { name: "B" })[1]).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(new Set(screen.getAllByRole("tab").map((tab) => tab.id)).size).toBe(4);
});
