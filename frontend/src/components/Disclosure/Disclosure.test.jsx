import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Disclosure } from "./Disclosure";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("shares state across wrappers, supports keyboard and isolates roots", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Disclosure>
        <header>
          <Disclosure.Trigger>First</Disclosure.Trigger>
        </header>
        <Disclosure.Panel>First content</Disclosure.Panel>
      </Disclosure>
      <Disclosure>
        <Disclosure.Trigger>Second</Disclosure.Trigger>
        <Disclosure.Panel>Second content</Disclosure.Panel>
      </Disclosure>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "First" });
  await user.tab();
  await user.keyboard("{Enter}");
  expect(trigger.getAttribute("aria-controls")).toBe(
    screen.getByText("First content").id,
  );

  expect(screen.getByText("First content")).toBeVisible();
  expect(screen.getByText("Second content")).not.toBeVisible();
  await user.keyboard(" ");
  expect(screen.getByText("First content")).not.toBeVisible();
});
test("supports controlled state and cancellable activation", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <Disclosure open={false} onOpenChange={change}>
      <Disclosure.Trigger onClick={(event) => event.preventBaseUIHandler()}>
        Open
      </Disclosure.Trigger>
      <Disclosure.Panel>Content</Disclosure.Panel>
    </Disclosure>,
  );
  await user.click(screen.getByRole("button"));
  expect(change).not.toHaveBeenCalled();
});

test("controlled changes notify the owner and wait for the supplied value", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  const view = (open) => (
    <Disclosure open={open} onOpenChange={change}>
      <Disclosure.Trigger>Details</Disclosure.Trigger>
      <Disclosure.Panel>Controlled panel</Disclosure.Panel>
    </Disclosure>
  );
  const { rerender } = render(view(false));
  await user.click(screen.getByRole("button"));
  expect(change).toHaveBeenCalledWith(true, expect.any(Object));
  expect(screen.getByText("Controlled panel")).not.toBeVisible();
  rerender(view(true));
  expect(screen.getByText("Controlled panel")).toBeVisible();
});
