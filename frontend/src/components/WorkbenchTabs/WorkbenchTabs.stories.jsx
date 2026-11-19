import React, { useLayoutEffect, useRef, useState } from "react";
import { WorkbenchTabs } from "./WorkbenchTabs";
import { Select } from "../Select/Select";
import "./WorkbenchTabs.stories.css";

export default { title: "Workbench/WorkbenchTabs", component: WorkbenchTabs };

const designTabs = [
  { id: "0", label: "Traces" },
  { id: "1", label: "Tool errors" },
  { id: "2", label: "Playground 1", kind: "playground" },
];

// Story-only decision overrides for comparison. Approved values can then be
// adopted in token JSON without introducing speculative production variants.
const sizes = [
  {
    value: "current",
    label: "Current",
    description:
      "192px max · 40px tab height · 32 × 32px close target · 24px highlight",
    style: {},
  },
  {
    value: "compact",
    label: "Compact",
    description:
      "160px max · 36px tab height · 28 × 28px close target · 20px highlight",
    style: {
      "--even-size-navigation-item-maximum": "10rem",
      "--even-size-control-default": "2.25rem",
      "--even-size-control-compact": "1.75rem",
    },
  },
  {
    value: "dense",
    label: "Dense",
    description:
      "144px max · 32px tab height · 24 × 24px close target · 16px highlight",
    style: {
      "--even-size-navigation-item-maximum": "9rem",
      "--even-size-control-default": "2rem",
      "--even-size-control-compact": "1.5rem",
    },
  },
];

function DesignFrame({ size }) {
  return (
    <div
      className="even-tabs-design-frame"
      data-preview-size={size.value}
      style={size.style}
    >
      <Example design initialActive="1" initialTabs={designTabs} />
    </div>
  );
}

function Example({
  count = 1,
  initialTabs,
  initialActive = "0",
  design = false,
}) {
  const [tabs, setTabs] = useState(
    () =>
      initialTabs ??
      Array.from({ length: count }, (_, index) => ({
        id: String(index),
        label: index ? `Traces ${index + 1}` : "Traces",
      })),
  );
  const [active, setActive] = useState(initialActive);
  const refs = useRef(new Map());
  const sequence = useRef(initialTabs?.length ?? count);
  const pendingFocus = useRef(false);
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      refs.current.get(active)?.focus();
      pendingFocus.current = false;
    }
  }, [active, tabs]);
  return (
    <WorkbenchTabs value={active} onValueChange={setActive}>
      <WorkbenchTabs.Bar>
        <WorkbenchTabs.List label="Example agent workbench tabs">
          {tabs.map((tab) => (
            <WorkbenchTabs.Tab
              key={tab.id}
              kind={tab.kind}
              value={tab.id}
              ref={(node) => {
                refs.current.set(tab.id, node);
              }}
              onClose={
                tab.id === "0"
                  ? undefined
                  : () => {
                      const index = tabs.indexOf(tab);
                      if (active === tab.id)
                        setActive((tabs[index + 1] ?? tabs[index - 1]).id);
                      pendingFocus.current = true;
                      setTabs(tabs.filter((item) => item.id !== tab.id));
                    }
              }
            >
              {tab.label}
            </WorkbenchTabs.Tab>
          ))}
        </WorkbenchTabs.List>
        <WorkbenchTabs.New
          onCreate={(kind) => {
            const id = String(sequence.current++);
            setTabs([
              ...tabs,
              {
                id,
                kind,
                label:
                  kind === "traces"
                    ? `Traces ${Number(id) + 1}`
                    : `Playground ${id}`,
              },
            ]);
            pendingFocus.current = true;
            setActive(id);
          }}
          finalFocus={() => refs.current.get(active)}
        />
      </WorkbenchTabs.Bar>
      {tabs.map((tab) => (
        <WorkbenchTabs.Panel key={tab.id} value={tab.id} keepMounted={false}>
          {design ? (
            <div className="even-tabs-design-content">
              <h2>{tab.label}</h2>
              <p>
                This panel belongs to the selected tab. Fixture content only.
              </p>
            </div>
          ) : (
            <p>Fixture view: {tab.label}. No agent is executed.</p>
          )}
        </WorkbenchTabs.Panel>
      ))}
    </WorkbenchTabs>
  );
}

export const Default = { render: () => <Example count={3} /> };
export const Overflow = {
  render: () => (
    <div className="even-tabs-design-frame" data-preview-size="current">
      <Example
        design
        initialTabs={Array.from({ length: 60 }, (_, index) => ({
          id: String(index),
          label:
            index === 0
              ? "Traces"
              : index < 8
                ? `Traces ${index + 1}`
                : `Traces ${index + 1} · Investigating long-running deployment and tool failures`,
        }))}
      />
    </div>
  ),
};

export const DesignSandbox = {
  render: function Sandbox() {
    const [value, setValue] = useState("compact");
    const size = sizes.find((option) => option.value === value);
    return (
      <section
        className="even-tabs-design-sandbox"
        aria-label="Tab design sandbox"
      >
        <p>
          Compare sizes using Tab size. Add or close tabs, resize the frame from
          its bottom-right corner, and compare themes.
        </p>
        <div className="even-tabs-design-controls">
          <Select
            label="Tab size"
            value={value}
            onValueChange={setValue}
            options={sizes.map(({ value, label }) => ({ value, label }))}
          />
          <p role="status">{size.description} (at a 16px root)</p>
        </div>
        <DesignFrame size={size} />
      </section>
    );
  },
};

export const SizeComparison = {
  render: () => (
    <section
      className="even-tabs-size-comparison"
      aria-label="Tab size comparison"
    >
      <p>
        All three previews use the same labels and selection. Switch, add, close
        and resize each independently. Values are preview overrides.
      </p>
      {sizes.map((size) => (
        <section key={size.value} aria-label={`${size.label} tab sizing`}>
          <header>
            <h2>{size.label}</h2>
            <p>{size.description} (at a 16px root)</p>
          </header>
          <DesignFrame size={size} />
        </section>
      ))}
    </section>
  ),
};
