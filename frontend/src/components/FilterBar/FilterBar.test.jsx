import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "./FilterBar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("removes an individual filter or clears all", async () => {
  const user = userEvent.setup(),
    remove = vi.fn(),
    clear = vi.fn();
  render(
    <FilterBar
      filters={[{ id: "error", label: "Errors" }]}
      onRemove={remove}
      onClear={clear}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Remove Errors filter" }),
  );
  expect(remove).toHaveBeenCalledWith("error");
  await user.click(screen.getByRole("button", { name: "Clear all filters" }));
  expect(clear).toHaveBeenCalledOnce();
});
