import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttributeList } from "./AttributeList";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("filters nested and null values while preserving exact copy content", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(
    <AttributeList
      attributes={{
        name: "support",
        input: { query: "deploy" },
        missing: null,
      }}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Filter attributes" }),
    "deploy",
  );
  expect(screen.queryByText("support")).not.toBeInTheDocument();
  expect(screen.getByText("input")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Copy input" }));
  expect(write).toHaveBeenCalledWith(
    JSON.stringify({ query: "deploy" }, null, 2),
  );
});
