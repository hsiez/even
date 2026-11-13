import React from "react";
import { ColorGrid } from "./ColorGrid";

export default { title: "Foundations/Colors", component: ColorGrid };
export const Light = { render: () => <ColorGrid theme="light" /> };
export const Dark = { render: () => <ColorGrid theme="dark" /> };
export const BothThemes = {
  render: () => (
    <div className="even-color-grid__both">
      <ColorGrid theme="light" />
      <ColorGrid theme="dark" />
    </div>
  ),
};
