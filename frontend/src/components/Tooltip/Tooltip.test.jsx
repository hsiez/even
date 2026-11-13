import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";
test("shows a nonessential hint on keyboard focus and can be dismissed with Escape", async () => {
  const user = userEvent.setup();
  render(
    <Tooltip.Provider delay={0}>
      <Tooltip>
        <Tooltip.Trigger>Refresh</Tooltip.Trigger>
        <Tooltip.Content>Refresh</Tooltip.Content>
      </Tooltip>
    </Tooltip.Provider>,
  );
  await user.tab();
  expect(
    await screen.findByText("Refresh", {
      selector: "[data-base-ui-focusable]",
    }),
  ).toHaveTextContent("Refresh");
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(
      screen.queryByText("Refresh", { selector: "[data-base-ui-focusable]" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("button")).toHaveFocus();
});
