import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("copies exact content and reports clipboard rejection without crashing", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const { rerender } = render(<CopyButton value={"exact\ncontent"} />);
  await user.click(screen.getByRole("button"));
  expect(write).toHaveBeenCalledWith("exact\ncontent");
  expect(screen.getByRole("status")).toHaveTextContent("Copied.");
  rerender(<CopyButton value="next" />);
  write.mockRejectedValueOnce(new Error("denied"));
  await user.click(screen.getByRole("button"));
  expect(screen.getByRole("status")).toHaveTextContent("Copy failed");
});

test("does not report a stale clipboard result after the value changes", async () => {
  const user = userEvent.setup();
  let resolve;
  vi.spyOn(navigator.clipboard, "writeText").mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { rerender } = render(<CopyButton value="old" />);
  await user.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toBeDisabled();
  rerender(<CopyButton value="new" />);
  await act(async () => resolve());
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});
