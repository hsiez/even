import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Conversation } from "./Conversation";
import { ViewExecutionAction } from "../ViewExecutionAction/ViewExecutionAction";
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
    await screen.findByRole("button", { name: "Follow latest activity" }),
  );
  expect(log.scrollTop).toBe(1000);
});

test.each([true, false])(
  "late execution actions respect following=%s without a parent message update",
  async (isFollowing) => {
    let finish;
    function DeferredExecution() {
      const [ready, setReady] = React.useState(false);
      finish = () => setReady(true);
      return (
        <ViewExecutionAction
          pending={!ready}
          traces={ready ? [{ traceId: "trace-1" }] : []}
          hrefForTrace={(id) => `#${id}`}
        />
      );
    }
    render(
      <Conversation
        messages={[
          {
            id: "1",
            role: "agent",
            content: "Done",
            executionAction: <DeferredExecution />,
          },
        ]}
      />,
    );
    const log = screen.getByRole("log");
    Object.defineProperties(log, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 100, configurable: true },
    });
    log.scrollTop = isFollowing ? 900 : 200;
    fireEvent.scroll(log);
    Object.defineProperty(log, "scrollHeight", {
      value: 1100,
      configurable: true,
    });
    await act(async () => finish());
    expect(
      await screen.findByRole("link", { name: "View execution" }),
    ).toHaveAttribute("href", "#trace-1");
    if (isFollowing) {
      expect(log.scrollTop).toBe(1100);
      expect(
        screen.queryByRole("button", { name: "Follow latest activity" }),
      ).toBeNull();
    } else {
      expect(log.scrollTop).toBe(200);
      expect(
        await screen.findByRole("button", { name: "Follow latest activity" }),
      ).toBeVisible();
    }
  },
);
