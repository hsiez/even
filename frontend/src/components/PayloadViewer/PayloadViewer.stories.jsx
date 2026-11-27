import React from "react";
import { PayloadViewer } from "./PayloadViewer";
import { CopyButton } from "../CopyButton/CopyButton";

export default { title: "Workbench/PayloadViewer", component: PayloadViewer };

export const Default = {
  render: function Example() {
    return (
      <PayloadViewer
        value={{ query: "deployment", items: [1, 2] }}
        label="Tool input"
      />
    );
  },
};

export const PlainText = {
  render: function Example() {
    return <PayloadViewer value="Permission denied" />;
  },
};

export const Empty = {
  render: function Example() {
    return <PayloadViewer value="" />;
  },
};

export const NotCaptured = {
  render: function Example() {
    return <PayloadViewer />;
  },
};

export const HighlightedJson = {
  render: () => (
    <PayloadViewer
      label="JSON sample"
      highlightJson
      value={{
        message: "<script> is text",
        count: 3,
        available: true,
        missing: null,
        items: ["one", "two"],
      }}
    />
  ),
};
export const CustomToolbar = {
  render: () => {
    const value = { message: "Complete original record", count: 3 };
    return (
      <PayloadViewer
        value={value}
        label="JSON sample"
        highlightJson
        showCopyButton={false}
        toolbar={
          <>
            <span>JSON</span>
            <CopyButton
              iconOnly
              label="Copy JSON sample"
              value={JSON.stringify(value, null, 2)}
            />
          </>
        }
      />
    );
  },
};
