import React from "react";
import { MotionGrid } from "./MotionGrid";

export default {
  title: "Foundations/Motion",
  component: MotionGrid,
  render: (args, context) => (
    <MotionGrid {...args} theme={args.theme ?? context.globals.theme} />
  ),
};
export const Options = { args: { kind: "options" } };
export const Decisions = { args: { kind: "decisions" } };
export const LargeAreas = { args: { kind: "large" } };
export const ReducedMotion = { args: { reduced: true } };
export const BothThemes = {
  render: () => (
    <>
      <MotionGrid theme="light" />
      <MotionGrid theme="dark" />
    </>
  ),
};
