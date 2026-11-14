import React from "react";
import { DimensionGrid } from "./DimensionGrid";
export default { title: "Foundations/Dimensions", component: DimensionGrid };
export const Options = { render: () => <DimensionGrid /> };
export const Spacing = { render: () => <DimensionGrid kind="space" /> };
export const Sizing = { render: () => <DimensionGrid kind="size" /> };
export const Dark = { render: () => <DimensionGrid theme="dark" /> };
