import React, { useState } from "react";
import { Menu } from "./Menu";
export default { title: "Primitives/Menu", component: Menu };
export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <Menu>
          <Menu.Trigger>Trace actions</Menu.Trigger>
          <Menu.Content aria-label="Trace actions">
            <Menu.Item onClick={() => setValue("copied")}>
              Copy trace ID
            </Menu.Item>
            <Menu.Item disabled>Delete trace</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={() => setValue("exported")}>
              Export trace
            </Menu.Item>
          </Menu.Content>
        </Menu>
        <output>{value}</output>
      </>
    );
  },
};
export const InitiallyOpen = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <Menu defaultOpen>
          <Menu.Trigger>Trace actions</Menu.Trigger>
          <Menu.Content aria-label="Trace actions">
            <Menu.Item onClick={() => setValue("copied")}>
              Copy trace ID
            </Menu.Item>
            <Menu.Item disabled>Delete trace</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={() => setValue("exported")}>
              Export trace
            </Menu.Item>
          </Menu.Content>
        </Menu>
        <output>{value}</output>
      </>
    );
  },
};
