import React, { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { useGlobals } from "storybook/preview-api";

export default { title: "Primitives/ThemeToggle", component: ThemeToggle };
function Example(props) {
  const [theme, setTheme] = useState("dark");
  return <ThemeToggle value={theme} onValueChange={setTheme} {...props} />;
}
export const Default = {
  render: (args) => <Example {...args} />,
  decorators: [
    (Story, context) => {
      const [globals, updateGlobals] = useGlobals();
      return (
        <Story
          args={{
            ...context.args,
            value: globals.theme,
            onValueChange: (theme) => updateGlobals({ theme }),
          }}
        />
      );
    },
  ],
};
export const Light = { render: () => <ThemeToggle defaultValue="light" /> };
export const Disabled = {
  render: () => <ThemeToggle defaultValue="dark" disabled />,
};
export const IndependentInstances = {
  render: () => (
    <>
      <Example aria-label="First theme" />
      <Example aria-label="Second theme" />
    </>
  ),
};
