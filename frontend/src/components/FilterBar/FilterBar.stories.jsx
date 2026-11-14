import React, { useState } from "react";
import { FilterBar } from "./FilterBar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/FilterBar", component: FilterBar };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <FilterBar
        filters={
          value === "removed" ? [] : [{ id: "agent", label: "Agent: Support" }]
        }
        onRemove={() => setValue("removed")}
        onClear={() => setValue("removed")}
      />
    );
  },
};
