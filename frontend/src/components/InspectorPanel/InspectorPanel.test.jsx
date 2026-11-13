import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InspectorPanel } from "./InspectorPanel";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("opens nonmodally, closes and restores focus to its opener", async () => {
  const user = userEvent.setup();
  function Example() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Inspect</button>
        <InspectorPanel open={open} onClose={() => setOpen(false)}>
          <InspectorPanel.Header>Details</InspectorPanel.Header>
          <InspectorPanel.Body>Span</InspectorPanel.Body>
          <InspectorPanel.Close />
        </InspectorPanel>
      </>
    );
  }
  render(<Example />);
  const opener = screen.getByRole("button", { name: "Inspect" });
  await user.click(opener);
  expect(
    screen.getByRole("complementary", { name: "Execution inspector" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(opener).toHaveFocus();
});
