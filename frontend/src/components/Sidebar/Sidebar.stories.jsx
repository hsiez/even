import React from "react";
import { Sidebar } from "./Sidebar";

export default { title: "Workbench/Sidebar", component: Sidebar };

export const Default = {
  render: function Example() {
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
