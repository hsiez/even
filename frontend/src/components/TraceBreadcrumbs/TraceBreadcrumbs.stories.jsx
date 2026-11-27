import React, { useState } from "react";
import { TraceBreadcrumbs } from "./TraceBreadcrumbs";
export default {
  title: "Trace viewer/TraceBreadcrumbs",
  component: TraceBreadcrumbs,
};
const trail = [
  { id: "support", label: "Support" },
  { id: "research", label: "Research" },
  { id: "source", label: "Source checking" },
];
export const Root = {
  render: () => <TraceBreadcrumbs items={trail.slice(0, 1)} />,
};
export const Nested = {
  render: function Example() {
    const [items, setItems] = useState(trail);
    return (
      <TraceBreadcrumbs
        items={items}
        showBack
        onNavigate={(id) =>
          setItems(
            trail.slice(0, trail.findIndex((item) => item.id === id) + 1),
          )
        }
      />
    );
  },
};
export const LongNames = {
  render: () => (
    <TraceBreadcrumbs
      items={[
        { id: "root", label: "Deployment investigation and recovery agent" },
        {
          id: "child",
          label:
            "Research for an unusually long deployment failure investigation",
        },
      ]}
      onNavigate={() => {}}
    />
  ),
};

export const InspectCurrent = {
  render: function Example() {
    const [selected, select] = useState();
    return (
      <>
        <TraceBreadcrumbs items={trail.slice(0, 1)} onSelectCurrent={select} />
        <output aria-live="polite">
          {selected
            ? `Inspecting ${selected} activation`
            : "Select the current breadcrumb to inspect its activation."}
        </output>
      </>
    );
  },
};
