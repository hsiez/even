import React, { useState } from "react";
import { TraceSearch } from "./TraceSearch";
const suggestions = [
  {
    query: "tool:read_logs tool.status:error",
    description: "Find a failed read_logs call",
  },
  {
    query: "tool:read_logs has:error",
    description: "Find reads in traces containing any error",
  },
  { query: 'output:"ECONNRESET"', description: "Search original tool results" },
];
export default { title: "Workbench/TraceSearch", component: TraceSearch };
function Example(props) {
  const [value, setValue] = useState(props.initialValue ?? "");
  return (
    <TraceSearch
      {...props}
      value={value}
      onValueChange={setValue}
      suggestions={suggestions}
    />
  );
}
export const Default = { render: () => <Example /> };
export const SuggestionsOpen = { render: () => <Example defaultOpen /> };
export const InvalidQuery = {
  render: () => (
    <Example
      initialValue="duration:soon"
      error="Use a duration such as duration:>3s or duration:>=500ms."
    />
  ),
};
export const Disabled = { render: () => <Example disabled /> };

export const Focused = {
  render: () => <Example inputProps={{ autoFocus: true }} />,
};
