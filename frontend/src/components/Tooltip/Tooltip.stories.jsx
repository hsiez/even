import React, { useState } from "react";
import { Tooltip } from "./Tooltip";
export default { title: "Primitives/Tooltip", component: Tooltip };
export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <Tooltip.Provider delay={0}>
          <Tooltip>
            <Tooltip.Trigger aria-label="Refresh traces">
              <span aria-hidden="true">↻</span>
            </Tooltip.Trigger>
            <Tooltip.Content>Refresh traces</Tooltip.Content>
          </Tooltip>
        </Tooltip.Provider>
        <output>{value}</output>
      </>
    );
  },
};
