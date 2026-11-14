import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("reports selection and respects disabled options", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <Select
      label="Agent"
      defaultValue="a"
      onValueChange={change}
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C", disabled: true },
      ]}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Agent" });
  await user.click(select);
  await user.click(await screen.findByRole("option", { name: "B" }));
  expect(change).toHaveBeenCalledWith("b");
  await user.click(select);
  await user.click(await screen.findByRole("option", { name: "C" }));
  expect(change).toHaveBeenCalledTimes(1);
});
