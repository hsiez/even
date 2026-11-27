import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/user-event";
import { PayloadViewer } from "./PayloadViewer";

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

test("registers the content element only when content exists", () => {
  const contentRef = React.createRef();
  const view = (value) => (
    <PayloadViewer value={value} contentRef={contentRef} />
  );
  const { rerender, unmount } = render(view(undefined));
  expect(contentRef.current).toBeNull();
  rerender(view({ answer: 42 }));
  expect(contentRef.current.tagName).toBe("PRE");
  rerender(view(""));
  expect(contentRef.current).toBeNull();
  rerender(view("Loaded"));
  expect(contentRef.current).toHaveTextContent("Loaded");
  unmount();
  expect(contentRef.current).toBeNull();
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
