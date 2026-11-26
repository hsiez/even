import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayloadViewer } from "./PayloadViewer";
import { trace, spans, agents, sessions } from "../../test/fixtures";

test("distinguishes absent, empty and malformed JSON and renders HTML as text", () => {
  const { rerender } = render(<PayloadViewer />);
  expect(screen.getByText("Not captured.")).toBeVisible();
  rerender(<PayloadViewer value="" />);
  expect(screen.getByText("Empty content.")).toBeVisible();
  rerender(<PayloadViewer value="{broken" />);
  expect(screen.getByText("{broken")).toBeVisible();
  rerender(<PayloadViewer value="<script>alert(1)</script>" />);
  expect(screen.getByText("<script>alert(1)</script>")).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
});
test("a custom toolbar replaces the default copy action without changing the record", () => {
  const value = { preserved: [1, true, null] };
  render(
    <PayloadViewer
      value={value}
      label="Custom JSON"
      highlightJson
      showCopyButton={false}
      toolbar={<span>JSON tools</span>}
    />,
  );
  expect(screen.getByText("JSON tools")).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
  expect(
    JSON.parse(
      screen.getByRole("region", { name: "Custom JSON content" }).textContent,
    ),
  ).toEqual(value);
});
