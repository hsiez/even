import React from "react";
import { Select } from "../Select/Select";
export function AgentSelector({
  agents,
  value,
  onValueChange,
  disabled = false,
}) {
  const known = agents.some((agent) => agent.id === value);
  return (
    <Select
      label="Agent"
      value={known ? value : ""}
      onValueChange={onValueChange}
      disabled={disabled || !agents.length}
      options={[
        {
          value: "",
          label: agents.length ? "Select an agent" : "No agents available",
          disabled: true,
        },
        ...agents.map((agent) => ({
          value: agent.id,
          label: agent.name ?? agent.id,
        })),
      ]}
    />
  );
}
