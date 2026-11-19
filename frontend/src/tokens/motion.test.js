import { expect, test } from "vitest";
import { readMotionTiming, motionDecisions } from "./motion";

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
