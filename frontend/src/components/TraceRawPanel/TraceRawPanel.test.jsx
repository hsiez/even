import React from "react";
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceRawPanel } from "./TraceRawPanel";
import { serializeValue } from "../AttributeList/AttributeList";

test("registers delayed JSON and replaces the content node when the selected span changes", () => {
  const contentRef = React.createRef();
  const first = { spanId: "first", attributes: {} };
  const { rerender, unmount } = render(
    <TraceRawPanel span={first} loading contentRef={contentRef} />,
  );
  expect(contentRef.current).toBeNull();
  rerender(<TraceRawPanel span={first} contentRef={contentRef} />);
  const original = contentRef.current;
  expect(original.tagName).toBe("PRE");
  rerender(
    <TraceRawPanel span={{ spanId: "second" }} contentRef={contentRef} />,
  );
  expect(contentRef.current).not.toBe(original);
  expect(JSON.parse(contentRef.current.textContent).spanId).toBe("second");
  unmount();
  expect(contentRef.current).toBeNull();
});
test("preserves the complete supplied record and copies JSON without interpreting payload strings", async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const span = {
    spanId: "x",
    startTimeNs: 1795200000000000001n,
    unknown: { nested: [true, null, 3] },
    attributes: { result: '{"code":"<script>text</script>"}' },
  };
  render(<TraceRawPanel span={span} />);
  const pre = screen.getByRole("region", { name: "raw span JSON content" });
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByText("JSON", { exact: true })).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Copy raw span JSON" }).textContent,
  ).toBe("");
  expect(pre.textContent).toBe(serializeValue(span));
  expect(JSON.parse(pre.textContent).attributes.result).toBe(
    span.attributes.result,
  );
  expect(document.querySelector("script")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Copy raw span JSON" }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    serializeValue(span),
  );
});
test("shows loading/error/empty states and delegates retry", async () => {
  const user = userEvent.setup(),
    retry = vi.fn();
  const { rerender } = render(<TraceRawPanel />);
  expect(screen.getByText(/Select a span in/)).toBeVisible();
  rerender(<TraceRawPanel loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading span");
  rerender(<TraceRawPanel error="Trace is gone" onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Trace is gone");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
test("shows selected-span duration and usage in the JSON header, preserving missing, partial and zero counts", () => {
  const span = {
    spanId: "model",
    startTimeNs: "0",
    endTimeNs: "500000000",
    attributes: {
      "gen_ai.usage.input_tokens": 128,
      "gen_ai.usage.output_tokens": 42,
    },
  };
  const { rerender } = render(<TraceRawPanel span={span} />);
  const metrics = screen.getByRole("group", { name: "Selected span metrics" });
  expect(metrics).toHaveTextContent("500 ms 170 tokens");
  rerender(<TraceRawPanel span={{ ...span, attributes: {} }} />);
  expect(metrics).toHaveTextContent("500 ms");
  expect(metrics).not.toHaveTextContent("tokens");
  rerender(
    <TraceRawPanel span={span} tokenUsage={{ count: 128, partial: true }} />,
  );
  expect(metrics).toHaveTextContent("≥128 tokens");
  rerender(
    <TraceRawPanel span={span} tokenUsage={{ count: 0, partial: false }} />,
  );
  expect(metrics).toHaveTextContent("0 tokens");
  rerender(<TraceRawPanel span={{ spanId: "unknown" }} />);
  expect(
    screen.getByRole("group", { name: "Selected span metrics" }),
  ).toHaveTextContent("Unknown duration");
});
