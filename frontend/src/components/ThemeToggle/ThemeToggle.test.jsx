import React, { useState } from "react";
import { test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

test("selects exactly one theme with pointer or keyboard and keeps icon names accessible", async () => {
  const user = userEvent.setup();
  function Example() {
    const [value, setValue] = useState("dark");
    return <ThemeToggle value={value} onValueChange={setValue} />;
  }
  render(<Example />);
  const light = screen.getByRole("radio", { name: "Light theme" });
  const dark = screen.getByRole("radio", { name: "Dark theme" });
  expect(dark).toBeChecked();
  await user.click(light);
  expect(light).toBeChecked();
  expect(dark).not.toBeChecked();
  await user.keyboard("{ArrowRight}");
  expect(dark).toBeChecked();
  expect(light).not.toBeChecked();
  expect(screen.queryByRole("img")).toBeNull();
});

test("instances are independent, disabled prevents selection, and callers can cancel", async () => {
  const user = userEvent.setup();
  const change = vi.fn((_value, details) => details.cancel());
  render(
    <>
      <ThemeToggle aria-label="First" defaultValue="dark" />
      <ThemeToggle aria-label="Second" defaultValue="light" />
      <ThemeToggle aria-label="Disabled" defaultValue="dark" disabled />
      <ThemeToggle
        aria-label="Canceled"
        defaultValue="dark"
        onValueChange={change}
      />
    </>,
  );
  const radio = (group, name) =>
    within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
      name,
    });
  await user.click(radio("First", "Light theme"));
  expect(radio("Second", "Light theme")).toBeChecked();
  await user.click(radio("Disabled", "Light theme"));
  expect(radio("Disabled", "Dark theme")).toBeChecked();
  await user.click(radio("Canceled", "Light theme"));
  expect(change).toHaveBeenCalled();
  expect(radio("Canceled", "Dark theme")).toBeChecked();
});
