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

export const RestoredWithoutFocus = {
  render: () => (
    <InspectorPanel autoFocus={false}>
      <InspectorPanel.Header>
        <h2>Restored inspection</h2>
      </InspectorPanel.Header>
      <InspectorPanel.Body>
        Restored details leave focus on the workbench tab. A new inspection
        still focuses its panel by default.
      </InspectorPanel.Body>
    </InspectorPanel>
  ),
};
