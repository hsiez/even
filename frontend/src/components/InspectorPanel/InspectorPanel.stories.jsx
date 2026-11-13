import React, { useState } from "react";
import { InspectorPanel } from "./InspectorPanel";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/InspectorPanel", component: InspectorPanel };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <button onClick={() => setValue("open")}>Open inspector</button>
        <InspectorPanel
          open={value === "open"}
          onClose={() => setValue("closed")}
        >
          <InspectorPanel.Header>
            <h2>Execution details</h2>
            <InspectorPanel.Close />
          </InspectorPanel.Header>
          <InspectorPanel.Body>Trace content</InspectorPanel.Body>
        </InspectorPanel>
      </>
    );
  },
};
