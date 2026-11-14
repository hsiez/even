import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("uses native keyboard activation, does not submit by default, and blocks pending clicks", async () => {
  const user = userEvent.setup(),
    click = vi.fn(),
    submit = vi.fn((e) => e.preventDefault());
  const { rerender } = render(
    <form onSubmit={submit}>
      <Button onClick={click}>Refresh</Button>
    </form>,
  );
  await user.tab();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(click).toHaveBeenCalledTimes(2);
  expect(submit).not.toHaveBeenCalled();
  rerender(
    <Button pending onClick={click}>
      Refresh
    </Button>,
  );
  await user.click(screen.getByRole("button"));
  expect(click).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
});

test("preserves caller styling, refs and Base UI state classes with visual variants", async () => {
  const user = userEvent.setup();
  const ref = React.createRef();
  const click = vi.fn();
  const view = (disabled) => (
    <Button
      ref={ref}
      variant="primary"
      size="compact"
      disabled={disabled}
      className={(state) =>
        state.disabled ? "consumer-disabled" : "consumer-ready"
      }
      style={{ minWidth: "12rem" }}
      onClick={click}
    >
      Run
    </Button>
  );
  const { rerender } = render(view(false));
  const button = screen.getByRole("button", { name: "Run" });
  expect(ref.current).toBe(button);
  expect(button).toHaveClass("even-button", "consumer-ready");
  expect(button.style.minWidth).toBe("12rem");
  expect(button).toHaveAttribute("data-variant", "primary");
  expect(button).toHaveAttribute("data-size", "compact");
  await user.click(button);
  expect(click).toHaveBeenCalledTimes(1);
  rerender(view(true));
  expect(button).toHaveClass("even-button", "consumer-disabled");
  await user.click(button);
  expect(click).toHaveBeenCalledTimes(1);
});
