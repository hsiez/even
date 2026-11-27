import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { AgentNavigation } from "./AgentNavigation";

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
