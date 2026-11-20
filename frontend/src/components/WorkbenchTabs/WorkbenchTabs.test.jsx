import React from "react";
import { expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkbenchTabs } from "./WorkbenchTabs";

test("decorative type icons preserve tab names, keyboard order and close targets", async () => {
  const user = userEvent.setup();
  render(
    <WorkbenchTabs defaultValue="traces">
      <WorkbenchTabs.Bar>
        <WorkbenchTabs.List label="Typed views">
          <WorkbenchTabs.Tab value="traces" kind="traces">
            Trace investigation
          </WorkbenchTabs.Tab>
          <WorkbenchTabs.Tab value="chat" kind="playground" onClose={() => {}}>
            Agent chat
          </WorkbenchTabs.Tab>
        </WorkbenchTabs.List>
      </WorkbenchTabs.Bar>
      <WorkbenchTabs.Panel value="traces">
        Recorded executions
      </WorkbenchTabs.Panel>
      <WorkbenchTabs.Panel value="chat">
        Conversation preview
      </WorkbenchTabs.Panel>
    </WorkbenchTabs>,
  );
  const traces = screen.getByRole("tab", {
    name: "Trace investigation",
    exact: true,
  });
  const chat = screen.getByRole("tab", { name: "Agent chat", exact: true });
  for (const tab of [traces, chat]) {
    expect(tab.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(tab.querySelector("svg")).toHaveAttribute("focusable", "false");
    expect(within(tab).queryByRole("img")).toBeNull();
  }
  await user.tab();
  expect(traces).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(chat).toHaveFocus();
  expect(chat).toHaveAttribute("aria-selected", "true");
  await user.tab();
  const close = screen.getByRole("button", {
    name: "Close Agent chat",
    exact: true,
  });
  expect(close).toHaveFocus();
  expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(close.querySelector("svg")).toHaveAttribute("focusable", "false");
});

test("Base UI owns keyboard selection and relationships; close controls stay outside tab buttons", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  render(
    <WorkbenchTabs defaultValue="first">
      <WorkbenchTabs.Bar>
        <WorkbenchTabs.List label="Investigations">
          <WorkbenchTabs.Tab value="first">Traces</WorkbenchTabs.Tab>
          <WorkbenchTabs.Tab value="second" onClose={close}>
            Traces 2
          </WorkbenchTabs.Tab>
        </WorkbenchTabs.List>
      </WorkbenchTabs.Bar>
      <WorkbenchTabs.Panel value="first">First view</WorkbenchTabs.Panel>
      <WorkbenchTabs.Panel value="second">Second view</WorkbenchTabs.Panel>
    </WorkbenchTabs>,
  );
  await user.tab();
  await user.keyboard("{ArrowRight}");
  const second = screen.getByRole("tab", { name: "Traces 2" });
  expect(second).toHaveFocus();
  expect(second).toHaveAttribute(
    "aria-controls",
    screen.getByRole("tabpanel").id,
  );
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Second view");
  expect(within(second).queryByRole("button")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Close Traces 2" })
      .closest('[role="tablist"]'),
  ).toBeNull();
  await user.keyboard("{Delete}");
  expect(close).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Close Traces 2" }));
  expect(close).toHaveBeenCalledTimes(2);
  expect(
    screen.queryByRole("button", { name: "Close Traces", exact: true }),
  ).toBeNull();
});

test("new-tab menu delegates creation and Escape returns focus without creating", async () => {
  const user = userEvent.setup();
  const create = vi.fn();
  render(
    <WorkbenchTabs defaultValue="first">
      <WorkbenchTabs.Bar>
        <WorkbenchTabs.List label="Investigations">
          <WorkbenchTabs.Tab value="first">Traces</WorkbenchTabs.Tab>
        </WorkbenchTabs.List>
        <WorkbenchTabs.New onCreate={create} />
      </WorkbenchTabs.Bar>
      <WorkbenchTabs.Panel value="first">First view</WorkbenchTabs.Panel>
    </WorkbenchTabs>,
  );
  const trigger = screen.getByRole("button", { name: "New tab" });
  expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(trigger.querySelector("svg")).toHaveAttribute("focusable", "false");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await waitFor(() =>
    expect(
      screen.getByRole("menuitem", { name: "New trace explorer" }),
    ).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(create).not.toHaveBeenCalled();
  await user.click(trigger);
  await user.click(
    await screen.findByRole("menuitem", { name: "New chat playground" }),
  );
  expect(create).toHaveBeenCalledWith("playground");
});

test.each(["browser", "base-ui"])(
  "Delete-to-close respects %s cancellation",
  async (kind) => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <WorkbenchTabs defaultValue="first">
        <WorkbenchTabs.Bar>
          <WorkbenchTabs.List label="Cancelable tabs">
            <WorkbenchTabs.Tab value="first">Traces</WorkbenchTabs.Tab>
            <WorkbenchTabs.Tab
              value="second"
              onClose={close}
              onKeyDown={(event) => {
                if (event.key !== "Delete") return;
                if (kind === "browser") event.preventDefault();
                else event.preventBaseUIHandler();
              }}
            >
              Guarded explorer
            </WorkbenchTabs.Tab>
          </WorkbenchTabs.List>
        </WorkbenchTabs.Bar>
        <WorkbenchTabs.Panel value="first">First view</WorkbenchTabs.Panel>
        <WorkbenchTabs.Panel value="second">Second view</WorkbenchTabs.Panel>
      </WorkbenchTabs>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}{Delete}");
    expect(screen.getByRole("tab", { name: "Guarded explorer" })).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Close Guarded explorer" }),
    );
    expect(close).toHaveBeenCalledTimes(1);
  },
);
