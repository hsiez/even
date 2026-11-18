import React, { useEffect, useMemo, useState } from "react";
import { createApiClient } from "../../api/client";
import { Button, Notice } from "../../components";
import { HomePage } from "../HomePage/HomePage";
import "./ConnectedApp.css";

export function ConnectedApp({
  initialize,
  clientFactory = createApiClient,
  dataLabel = "Local Eve",
}) {
  const [inventory, setInventory] = useState();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.evenTheme ?? "dark",
  );
  const client = useMemo(() => clientFactory(), [clientFactory]);
  useEffect(() => {
    document.documentElement.dataset.evenTheme = theme;
  }, [theme]);
  useEffect(() => {
    setInventory(undefined);
    let alive = true;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => initialize?.())
      .then(() => client.inventory({ signal: controller.signal }))
      .then(
        (value) => {
          if (alive) setInventory(value);
        },
        (failure) => {
          if (alive && failure.name !== "AbortError") setError(failure.message);
        },
      );
    return () => {
      alive = false;
      controller.abort();
    };
  }, [client, attempt, initialize]);
  if (!inventory)
    return (
      <main className="even-connection" aria-label="Even workspace">
        <h1>Even</h1>
        {error ? (
          <Notice
            urgent
            action={
              <Button
                onClick={() => {
                  setError("");
                  setAttempt((value) => value + 1);
                }}
              >
                Retry connection
              </Button>
            }
          >
            {error}
          </Notice>
        ) : (
          <Notice>Loading workspace…</Notice>
        )}
      </main>
    );
  if (!inventory.agents.length)
    return (
      <main className="even-connection">
        <h1>Even</h1>
        <Notice>No agents were found in this project.</Notice>
      </main>
    );
  return (
    <HomePage
      workspaceName="Local workspace"
      agents={inventory.agents.map((agent) => ({
        ...agent,
        name: agent.name ?? agent.id,
      }))}
      initialAgentId={inventory.agents[0].id}
      allowAllAgents={false}
      dataSource={client}
      dataLabel={dataLabel}
      actions={
        <>
          <Button
            variant="ghost"
            size="compact"
            onClick={() =>
              setTheme((value) => (value === "dark" ? "light" : "dark"))
            }
          >
            Use {theme === "dark" ? "light" : "dark"} theme
          </Button>
        </>
      }
    />
  );
}
