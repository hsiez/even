import "../components.css";
import React from "react";
export function AgentNavigation({
  agentId,
  current = "traces",
  basePath = "/agents",
}) {
  const base = `${basePath}/${encodeURIComponent(agentId)}`;
  return (
    <ul className="even-agent-navigation">
      {[
        ["traces", "Traces"],
        ["playground", "Playground"],
      ].map(([id, label]) => (
        <li key={id}>
          <a
            href={`${base}/${id}`}
            aria-current={current === id ? "page" : undefined}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
