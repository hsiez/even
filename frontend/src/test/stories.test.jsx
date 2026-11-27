import React from "react";
import { test, expect } from "vitest";

import axe from "axe-core";

const modules = import.meta.glob(
  ["../components/**/*.stories.jsx", "../pages/**/*.stories.jsx"],
  {
    eager: true,
  },
);
for (const [path, stories] of Object.entries(modules)) {
  for (const [name] of Object.entries(stories)) {
    if (name === "default") continue;
    test(`${path}: ${name} renders accessible unstyled markup`, async () => {
      const results = await axe.run(document.body, {
        rules: {
          "color-contrast": { enabled: false },
          region: { enabled: false },
        },
      });
      expect(
        results.violations.map(({ id, nodes }) => ({
          id,
          elements: nodes.map((node) => node.html),
        })),
      ).toEqual([]);
    });
  }
}
