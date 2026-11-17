import React, { useRef, useState } from "react";
import { HomePage } from "./HomePage";
import { Button } from "../../components";
import { createSampleTrace, previewAgents, previewTraces } from "./previewData";

export default {
  title: "Pages/HomePage",
  component: HomePage,
  parameters: { layout: "fullscreen" },
};
const data = {
  workspaceName: "Staging workspace",
  agents: previewAgents,
  traces: previewTraces,
  dataLabel: "Staging · simulated data",
};

export const Staging = {
  render: function Example() {
    const [traces, setTraces] = useState(previewTraces);
    const sequence = useRef(previewTraces.length);
    return (
      <HomePage
        {...data}
        traces={traces}
        actions={
          <Button
            size="compact"
            onClick={() => {
              const trace = createSampleTrace(++sequence.current);
              setTraces((previous) => [trace, ...previous]);
            }}
          >
            Generate sample trace
          </Button>
        }
      />
    );
  },
};
export const Empty = { render: () => <HomePage {...data} traces={[]} /> };
export const Loading = {
  render: () => <HomePage {...data} traces={[]} loading />,
};
export const Error = {
  render: function Example() {
    const [failed, setFailed] = useState(true);
    return (
      <HomePage
        {...data}
        traces={failed ? [] : previewTraces}
        error={failed ? "Could not read recorded traces." : undefined}
        onRefresh={() => setFailed(false)}
      />
    );
  },
};

export const SearchPrototype = {
  render: () => (
    <HomePage {...data} initialQuery="tool:read_logs tool.status:error" />
  ),
};
export const OutputMatch = {
  render: () => <HomePage {...data} initialQuery={'output:"ECONNRESET"'} />,
};
