import { expect, test } from "vitest";
import {
  readInteractionDelay,
  readMotionTiming,
  motionDecisions,
} from "./motion";

test("removal gap and reflow use independent decisions without changing ordinary movement or exit", () => {
  const element = document.createElement("div");
  document.body.append(element);
  element.style.setProperty("--even-motion-duration-exit", "400ms");
  element.style.setProperty("--even-motion-duration-move", "500ms");
  expect(readInteractionDelay(element, "removal")).toBe(75);
  expect(readInteractionDelay(element, "repeat")).toBe(500);
  expect(readInteractionDelay(element, "scroll-idle")).toBe(120);
  expect(readMotionTiming(element, "reflow").duration).toBe(150);
  expect(readMotionTiming(element, "reflow-rapid").duration).toBe(100);
  element.style.setProperty("--even-interaction-delay-removal", "0.05s");
  element.style.setProperty("--even-motion-duration-reflow", "125ms");
  expect(readInteractionDelay(element, "removal")).toBe(50);
  expect(readMotionTiming(element, "reflow").duration).toBe(125);
  element.style.setProperty("--even-interaction-delay-removal", "0s");
  expect(readInteractionDelay(element, "removal")).toBe(0);
  element.style.setProperty("--even-interaction-delay-scroll-idle", "0.35s");
  expect(readInteractionDelay(element, "scroll-idle")).toBe(350);
  expect(readInteractionDelay(element, "repeat")).toBe(500);
  element.remove();
});

test("WAAPI timing uses generated defaults and resolves caller CSS overrides in milliseconds", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const defaults = readMotionTiming(element, "move");
  expect(defaults.easing).toBe(
    motionDecisions.find((token) => token.name === "easing.move").value,
  );
  element.style.setProperty("--even-motion-duration-move", "0.375s");
  element.style.setProperty("--even-motion-easing-move", "linear");
  expect(readMotionTiming(element, "move")).toEqual({
    duration: 375,
    easing: "linear",
  });
  element.style.setProperty("--even-motion-duration-move", "85ms");
  expect(readMotionTiming(element, "move").duration).toBe(85);
  element.style.setProperty("--even-motion-duration-move", "0s");
  expect(readMotionTiming(element, "move").duration).toBe(0);
  element.style.setProperty("--even-motion-duration-move", "invalid");
  expect(readMotionTiming(element, "move")).toEqual({
    ...defaults,
    easing: "linear",
  });
  element.remove();
});
