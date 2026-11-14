import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("associates label, description and error and supports controlled updates", async () => {
  const user = userEvent.setup();
  function Example() {
    const [value, setValue] = React.useState("");
    return (
      <TextField
        label="Query"
        description="Search history"
        error="Invalid query"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }
  render(<Example />);
  const field = screen.getByRole("textbox", { name: "Query" });
  expect(field).toHaveAccessibleDescription("Search history Invalid query");
  expect(field).toHaveAttribute("aria-invalid", "true");
  await user.type(field, "tool");
  expect(field).toHaveValue("tool");
});

test("retains native readonly and disabled behavior", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  const { rerender } = render(
    <TextField label="Trace ID" readOnly value="id" onChange={change} />,
  );
  await user.type(screen.getByRole("textbox"), "ignored");
  expect(change).not.toHaveBeenCalled();
  rerender(
    <TextField label="Trace ID" disabled value="id" onChange={change} />,
  );
  expect(screen.getByRole("textbox")).toBeDisabled();
});
