import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageComposer } from "./MessageComposer";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("rejects blank input, submits once, preserves drafts on failure and allows retry", async () => {
  const user = userEvent.setup();
  let reject;
  const send = vi.fn(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(<MessageComposer onSend={send} />);
  const input = screen.getByRole("textbox", { name: "Message" }),
    button = screen.getByRole("button", { name: "Send message" });
  expect(button).toBeDisabled();
  await user.type(input, "Inspect logs{Enter}please");
  await user.click(button);
  expect(send).toHaveBeenCalledWith("Inspect logs\nplease");
  expect(button).toBeDisabled();
  await user.click(button);
  expect(send).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("Offline")));
  expect(input).toHaveValue("Inspect logs\nplease");
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  send.mockResolvedValueOnce();
  await user.click(button);
  expect(input).toHaveValue("");
});
