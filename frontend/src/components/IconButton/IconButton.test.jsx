import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./IconButton";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("provides a name independently of decorative content", async () => {
  const click = vi.fn(),
    user = userEvent.setup();
  render(
    <IconButton label="Close inspector" onClick={click}>
      ×
    </IconButton>,
  );
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  expect(click).toHaveBeenCalledOnce();
});
