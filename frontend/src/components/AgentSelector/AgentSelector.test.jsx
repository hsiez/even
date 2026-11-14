import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentSelector } from "./AgentSelector";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("supports empty, unknown and selected agent scope", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  const { rerender } = render(
    <AgentSelector agents={[]} onValueChange={change} />,
  );
  expect(screen.getByRole("combobox")).toBeDisabled();
  rerender(
    <AgentSelector agents={agents} value="missing" onValueChange={change} />,
  );
  expect(screen.getByRole("combobox")).toHaveTextContent("Select an agent");
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Research" }));
  expect(change).toHaveBeenCalledWith("research");
});
