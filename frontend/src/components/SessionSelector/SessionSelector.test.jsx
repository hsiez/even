import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionSelector } from "./SessionSelector";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("limits claims to current launch and exposes creation state and errors", async () => {
  const user = userEvent.setup(),
    create = vi.fn(),
    change = vi.fn();
  const { rerender } = render(
    <SessionSelector
      sessions={sessions}
      value="session-1"
      onValueChange={change}
      onCreate={create}
    />,
  );
  expect(screen.getByText(/during this Even launch/)).toBeVisible();
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Follow-up" }));
  expect(change).toHaveBeenCalledWith("session-2");
  await user.click(screen.getByRole("button"));
  expect(create).toHaveBeenCalledOnce();
  rerender(
    <SessionSelector sessions={[]} creating error="Channel unavailable" />,
  );
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Channel unavailable");
});
