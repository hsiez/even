import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Notice } from "./Notice";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("announces urgent failures separately from ordinary status", () => {
  const { rerender } = render(<Notice>Recorded spans only</Notice>);
  expect(screen.getByRole("status")).toHaveTextContent("Recorded spans only");
  rerender(<Notice urgent>Read failed</Notice>);
  expect(screen.getByRole("alert")).toHaveTextContent("Read failed");
});
