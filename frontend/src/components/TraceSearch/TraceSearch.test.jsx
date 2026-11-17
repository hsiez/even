import React, { useState } from "react";
import { test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceSearch } from "./TraceSearch";
const suggestions = [
  { query: "tool:read_logs", description: "Read operations" },
  { query: "tool:publish_release", description: "Publish operations" },
];
function Example(props) {
  const [value, setValue] = useState("");
  return (
    <TraceSearch
      value={value}
      onValueChange={setValue}
      suggestions={suggestions}
      {...props}
    />
  );
}
test("Base UI navigates suggestions, commits a query, dismisses and clears", async () => {
  const user = userEvent.setup();
  const commit = vi.fn();
  render(<Example onCommit={commit} />);
  const input = screen.getByRole("combobox", { name: "Search traces" });
  expect(input).toHaveAttribute("placeholder", "Search traces...");
  expect(screen.queryByText("Search traces", { selector: "label" })).toBeNull();
  await user.click(input);
  expect(
    screen.getByRole("listbox", { name: "Search suggestions" }),
  ).toBeVisible();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input).toHaveValue("tool:read_logs");
  expect(input).toHaveAccessibleName("Search traces");
  expect(commit).toHaveBeenCalledWith("tool:read_logs");
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.click(input);
  await user.keyboard("{Escape}");
  expect(input).toHaveFocus();
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect(input).toHaveValue("");
});
test("free text submits without forcing a suggestion and links validation", async () => {
  const user = userEvent.setup();
  const commit = vi.fn();
  render(<Example onCommit={commit} error="Close the quote" />);
  const input = screen.getByRole("combobox");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(
    expect.stringContaining("Close the quote"),
  );
  await user.type(input, "ECONNRESET{Enter}");
  expect(commit).toHaveBeenCalledWith("ECONNRESET");
});
test("instances keep input values and popup selection independent; disabled blocks input", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Example label="First search" />
      <Example label="Second search" />
      <Example label="Unavailable search" disabled />
    </>,
  );
  const first = screen.getByRole("combobox", { name: "First search" });
  await user.click(first);
  await user.click(
    screen.getByRole("option", { name: /tool:publish_release/ }),
  );
  expect(first).toHaveValue("tool:publish_release");
  expect(screen.getByRole("combobox", { name: "Second search" })).toHaveValue(
    "",
  );
  expect(
    within(
      screen.getByRole("search", { name: "Unavailable search" }),
    ).getByRole("combobox"),
  ).toBeDisabled();
});

test("passes cancellation details through without committing a rejected suggestion", async () => {
  const user = userEvent.setup();
  const commit = vi.fn();
  render(
    <TraceSearch
      value=""
      onValueChange={(_value, details) => details.cancel()}
      onCommit={commit}
      suggestions={suggestions}
    />,
  );
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: /tool:read_logs/ }));
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(commit).not.toHaveBeenCalled();
});
