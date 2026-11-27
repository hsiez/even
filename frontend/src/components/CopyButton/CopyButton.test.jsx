import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";

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

test("returning to an earlier value does not revive its old clipboard request or replace the focused button", async () => {
  let resolve;
  const write = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(undefined);
  const { rerender } = render(<CopyButton value="first" />);
  const button = screen.getByRole("button");
  button.focus();
  fireEvent.click(button);
  rerender(<CopyButton value="second" />);
  rerender(<CopyButton value="first" />);
  expect(screen.getByRole("button")).toBe(button);
  expect(button).toHaveFocus();
  await act(async () => resolve());
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  fireEvent.click(button);
  await act(async () => {});
  expect(write).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status")).toHaveTextContent("Copied.");
});
test("icon-only copy keeps its action name, announces success and exposes a retryable failure", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const { rerender } = render(
    <CopyButton iconOnly value="original" label="Copy raw span JSON" />,
  );
  const control = screen.getByRole("button", { name: "Copy raw span JSON" });
  expect(control.textContent).toBe("");
  expect(control.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  await user.click(control);
  expect(write).toHaveBeenCalledWith("original");
  expect(screen.getByRole("status")).toHaveTextContent("Copied.");
  rerender(<CopyButton iconOnly value="new" label="Copy raw span JSON" />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  write.mockRejectedValueOnce(new Error("denied"));
  await user.click(control);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Copy failed. Try again.",
  );
  expect(control).toBeEnabled();
});
