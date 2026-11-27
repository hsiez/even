import React from "react";
import { WorkbenchLayout } from "./WorkbenchLayout";

export default {
  title: "Workbench/WorkbenchLayout",
  component: WorkbenchLayout,
};

export const Default = {
  render: function Example() {
    return (
      <WorkbenchLayout
        navigation={<nav aria-label="Agents">Support</nav>}
        inspector={<aside aria-label="Inspector">Select a trace</aside>}
      >
        Trace explorer
      </WorkbenchLayout>
    );
  },
};

import { WorkbenchFixture } from "../../test/WorkbenchFixture";
export const ComposedExplorer = { render: () => <WorkbenchFixture /> };
