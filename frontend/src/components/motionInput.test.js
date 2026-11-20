import { expect, test } from "vitest";
import { observeMotionInput, isKeyboardMotion } from "./motionInput";

test("multiple controls share input observation until the last one unmounts", () => {
  const host = document.implementation.createHTMLDocument();
  const element = host.createElement("div");
  const first = observeMotionInput(host);
  const second = observeMotionInput(host);
  host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(isKeyboardMotion(element)).toBe(true);
  first();
  first();
  host.dispatchEvent(new Event("pointerdown"));
  expect(isKeyboardMotion(element)).toBe(false);
  host.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(isKeyboardMotion(element)).toBe(true);
  second();
  expect(isKeyboardMotion(element)).toBe(false);
  host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(isKeyboardMotion(element)).toBe(false);
});

test("modifier keys do not suppress pointer motion and cleanup restores the host attribute", () => {
  const host = document.implementation.createHTMLDocument();
  host.documentElement.setAttribute("data-even-motion-input", "host-value");
  const cleanup = observeMotionInput(host);
  host.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
  expect(host.documentElement.getAttribute("data-even-motion-input")).toBe(
    "host-value",
  );
  host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(isKeyboardMotion(host.body)).toBe(true);
  cleanup();
  expect(host.documentElement.getAttribute("data-even-motion-input")).toBe(
    "host-value",
  );
});
