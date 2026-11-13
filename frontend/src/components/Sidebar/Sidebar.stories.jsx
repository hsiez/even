import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/Sidebar", component: Sidebar };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Sidebar>
        <a href="#traces" aria-current="page">
          Traces
        </a>
        <a href="#playground">Playground</a>
      </Sidebar>
    );
  },
};
