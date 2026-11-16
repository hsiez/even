import React from "react";
import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkbenchFixture } from "./WorkbenchFixture";

test("finds a trace, selects an operation, closes details and switches scope", async () => {
  const user = userEvent.setup();
  render(<WorkbenchFixture />);
  await user.click(
    screen.getByRole("button", { name: "Investigate deployment" }),
  );
  const inspector = screen.getByRole("complementary", {
    name: "Execution inspector",
  });
  await user.click(
    within(inspector).getByRole("treeitem", { name: "Read deployment logs" }),
  );
  expect(
    within(inspector).getByRole("region", { name: "Span details" }),
  ).toHaveTextContent("Permission denied");
  await user.click(
    within(inspector).getByRole("button", { name: "Close inspector" }),
  );
  await user.type(
    screen.getByRole("searchbox", { name: "Search traces" }),
    "nothing",
  );
  expect(screen.getByRole("status")).toHaveTextContent("No traces match");
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  await user.click(screen.getByRole("combobox", { name: "Agent" }));
  await user.click(await screen.findByRole("option", { name: "Research" }));
  expect(screen.getByRole("status")).toHaveTextContent("No recorded traces");
});

test("creates an isolated playground session and sends text through the composer", async () => {
  const user = userEvent.setup();
  render(<WorkbenchFixture />);
  await user.click(screen.getByRole("tab", { name: "Playground" }));
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "New session" }));
  await user.type(
    screen.getByRole("textbox", { name: "Message" }),
    "Inspect deployment",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("log")).toHaveTextContent("Inspect deployment");
  await user.click(screen.getByRole("button", { name: "New session" }));
  expect(screen.getByRole("log")).not.toHaveTextContent("Inspect deployment");
});

test("demonstrates a reload occurrence and keeps chronological markers out of duration sorting", async () => {
  const user = userEvent.setup();
  render(<WorkbenchFixture />);
  expect(screen.getAllByText("Agent reloaded")).toHaveLength(1);
  await user.click(
    screen.getByRole("button", { name: "Simulate reload (fixture)" }),
  );
  expect(screen.getAllByText("Agent reloaded")).toHaveLength(2);
  const rows = screen.getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Agent reloaded");
  await user.click(
    screen.getByRole("button", { name: "Duration", exact: true }),
  );
  expect(screen.queryByText("Agent reloaded")).toBeNull();
});
