import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InspectorPanel } from "./InspectorPanel";

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

test("restoring an inspector can leave keyboard focus on the workbench tab", async () => {
  const user = userEvent.setup();
  const example = (open) => (
    <>
      <button>Workbench tab</button>
      <InspectorPanel open={open} autoFocus={false}>
        Restored details
      </InspectorPanel>
    </>
  );
  const { rerender } = render(example(false));
  await user.click(screen.getByRole("button", { name: "Workbench tab" }));
  rerender(example(true));
  expect(screen.getByRole("button", { name: "Workbench tab" })).toHaveFocus();
  expect(screen.getByRole("complementary")).toBeVisible();
});

test("Strict Mode preserves the opener and ordinary updates do not steal outside focus", () => {
  const view = (open, text) => (
    <React.StrictMode>
      <button>Outside</button>
      <InspectorPanel open={open}>{text}</InspectorPanel>
    </React.StrictMode>
  );
  const { rerender } = render(view(false, "Initial"));
  const outside = screen.getByRole("button", { name: "Outside" });
  outside.focus();
  rerender(view(true, "Initial"));
  expect(screen.getByRole("complementary")).toHaveFocus();
  rerender(view(false, "Initial"));
  expect(outside).toHaveFocus();
  rerender(view(true, "Initial"));
  outside.focus();
  rerender(view(true, "Updated"));
  expect(outside).toHaveFocus();
  rerender(view(false, "Updated"));
  expect(outside).toHaveFocus();
});
