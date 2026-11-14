import React, { useEffect } from "react";
import "../src/components/components.css";
import "./preview.css";

function Theme({ theme, children }) {
  useEffect(() => {
    document.documentElement.dataset.evenTheme = theme;
  }, [theme]);
  return children;
}

export default {
  globalTypes: {
    theme: {
      description: "Even theme (including portalled content)",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  // The browser gate owns axe runs; the panel remains available on demand.
  initialGlobals: { theme: "dark", a11y: { manual: true } },
  decorators: [
    (Story, context) =>
      React.createElement(Theme, {
        theme: context.globals.theme === "light" ? "light" : "dark",
        children: React.createElement(Story),
      }),
  ],
  parameters: { layout: "padded", a11y: { test: "error" } },
  tags: ["autodocs"],
};
