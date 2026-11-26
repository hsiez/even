import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceBreadcrumbs } from "./TraceBreadcrumbs";
test("names the ancestry, marks the current activation and supports keyboard navigation", async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  render(
    <TraceBreadcrumbs
      items={[
        { id: "root", label: "Support" },
        { id: "child", label: "Research" },
      ]}
      onNavigate={navigate}
    />,
  );
  expect(screen.getByRole("navigation")).toHaveAccessibleName(
    "Agent execution ancestry",
  );
  expect(screen.getByText("Research")).toHaveAttribute(
    "aria-current",
    "location",
  );
  expect(screen.queryByRole("button", { name: "Research" })).toBeNull();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(navigate).toHaveBeenCalledWith("root");
});
test("does not offer nonfunctional ancestor controls without a navigation handler", () => {
  render(
    <TraceBreadcrumbs
      items={[
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ]}
    />,
  );
  expect(screen.getByRole("button", { name: "A" })).toBeDisabled();
});
test("the current activation can be inspected without navigating away", async () => {
  const inspect = vi.fn(),
    navigate = vi.fn(),
    user = userEvent.setup();
  render(
    <TraceBreadcrumbs
      items={[{ id: "root", label: "Support" }]}
      onSelectCurrent={inspect}
      onNavigate={navigate}
    />,
  );
  const current = screen.getByRole("button", { name: "Support" });
  expect(current).toHaveAttribute("aria-current", "location");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(inspect).toHaveBeenCalledWith("root");
  expect(navigate).not.toHaveBeenCalled();
});
test("the explicit back action opens the immediate parent and is absent at the root", async () => {
  const navigate = vi.fn(),
    user = userEvent.setup();
  const { rerender } = render(
    <TraceBreadcrumbs
      showBack
      items={[
        { id: "root", label: "Support" },
        { id: "child", label: "Research" },
      ]}
      onNavigate={navigate}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Back to Support" }));
  expect(navigate).toHaveBeenCalledWith("root");
  rerender(
    <TraceBreadcrumbs
      showBack
      items={[{ id: "root", label: "Support" }]}
      onNavigate={navigate}
    />,
  );
  expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
});
