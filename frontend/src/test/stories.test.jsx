import React from "react";
import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";

const modules = import.meta.glob("../components/**/*.stories.jsx", {
  eager: true,
});
for (const [path, stories] of Object.entries(modules)) {
  for (const [name, story] of Object.entries(stories)) {
    if (name === "default") continue;
    test(`${path}: ${name} renders accessible unstyled markup`, async () => {
      const Example = story.render;
      const { container } = render(<Example />);
      const results = await axe.run(document.body, {
        rules: {
          // Color/layout are not implemented, and isolated components need not be pages.
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
