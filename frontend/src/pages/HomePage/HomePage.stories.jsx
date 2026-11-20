import React, { useRef, useState } from "react";
import { useGlobals } from "storybook/preview-api";
import { HomePage } from "./HomePage";
import { Button } from "../../components";
import { createSampleTrace, previewAgents, previewTraces } from "./previewData";

export default {
  title: "Pages/HomePage",
  component: HomePage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => {
      const [globals, updateGlobals] = useGlobals();
      return (
        <Story
          args={{
            ...context.args,
            theme: globals.theme,
            onThemeChange: (theme) => updateGlobals({ theme }),
          }}
        />
      );
    },
  ],
};
const data = {
  workspaceName: "Staging workspace",
  agents: previewAgents,
  traces: previewTraces,
  dataLabel: "Staging · simulated data",
};

export const Staging = {
  render: function Example(args) {
    const [traces, setTraces] = useState(previewTraces);
    const sequence = useRef(previewTraces.length);
    return (
      <HomePage
        {...data}
        {...args}
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
export const Empty = {
  render: (args) => <HomePage {...data} {...args} traces={[]} />,
};
export const Loading = {
  render: (args) => <HomePage {...data} {...args} traces={[]} loading />,
};
export const Error = {
  render: function Example(args) {
    const [failed, setFailed] = useState(true);
    return (
      <HomePage
        {...data}
        {...args}
        traces={failed ? [] : previewTraces}
        error={failed ? "Could not read recorded traces." : undefined}
        onRefresh={() => setFailed(false)}
      />
    );
  },
};

export const SearchPrototype = {
  render: (args) => (
    <HomePage
      {...data}
      {...args}
      initialQuery="tool:read_logs tool.status:error"
    />
  ),
};
export const OutputMatch = {
  render: (args) => (
    <HomePage {...data} {...args} initialQuery={'output:"ECONNRESET"'} />
  ),
};

export const AgentSpaces = {
  render: (args) => (
    <HomePage
      {...data}
      {...args}
      initialAgentId="support"
      allowAllAgents={false}
    />
  ),
};

export const ManyAgents = {
  render: (args) => (
    <HomePage
      {...data}
      {...args}
      agents={Array.from({ length: 30 }, (_, index) => ({
        id: `fixture-agent-${index + 1}`,
        name: `Fixture agent ${index + 1}`,
      }))}
      traces={[]}
      initialAgentId="fixture-agent-1"
      allowAllAgents={false}
    />
  ),
};
