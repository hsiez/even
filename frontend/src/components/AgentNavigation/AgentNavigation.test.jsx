import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentNavigation } from "./AgentNavigation";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("encodes agent paths and identifies the current destination", () => {
  render(<AgentNavigation agentId="a/b" current="playground" />);
  expect(screen.getByRole("link", { name: "Traces" })).toHaveAttribute(
    "href",
    "/agents/a%2Fb/traces",
  );
  expect(screen.getByRole("link", { name: "Playground" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
