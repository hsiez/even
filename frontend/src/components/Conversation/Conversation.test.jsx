import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Conversation } from "./Conversation";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("updates repeated message IDs without duplicate messages or executable markup", () => {
  const { rerender } = render(
    <Conversation
      messages={[{ id: "1", role: "agent", content: "Working" }]}
    />,
  );
  rerender(
    <Conversation
      messages={[
        { id: "1", role: "agent", content: "Working" },
        { id: "1", role: "agent", content: "<b>Done</b>" },
      ]}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("<b>Done</b>")).toBeVisible();
});
test("preserves reading position while updates arrive and offers explicit follow", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <Conversation messages={[{ id: "1", role: "user", content: "Hello" }]} />,
  );
  const log = screen.getByRole("log");
  Object.defineProperties(log, {
    scrollHeight: { value: 1000, configurable: true },
    clientHeight: { value: 100, configurable: true },
  });
  log.scrollTop = 200;
  fireEvent.scroll(log);
  rerender(
    <Conversation
      messages={[
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "agent", content: "Reply" },
      ]}
    />,
  );
  expect(log.scrollTop).toBe(200);
  await user.click(
    screen.getByRole("button", { name: "Follow latest activity" }),
  );
  expect(log.scrollTop).toBe(1000);
});
