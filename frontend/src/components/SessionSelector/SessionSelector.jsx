import "../components.css";
import React from "react";
import { Select } from "../Select/Select";
import { Button } from "../Button/Button";
import { Notice } from "../Notice/Notice";
export function SessionSelector({
  sessions,
  value,
  onValueChange,
  onCreate,
  creating = false,
  error,
}) {
  const known = sessions.some((session) => session.id === value);
  return (
    <section
      className="even-session-selector"
      aria-label="Current-launch sessions"
    >
      <p>Sessions created during this Even launch.</p>
      <Select
        label="Session"
        value={known ? value : ""}
        onValueChange={onValueChange}
        disabled={!sessions.length}
        options={[
          {
            value: "",
            label: sessions.length ? "Select a session" : "No sessions yet",
            disabled: true,
          },
          ...sessions.map((session) => ({
            value: session.id,
            label: session.title ?? session.id,
          })),
        ]}
      />
      <Button pending={creating} onClick={onCreate}>
        New session
      </Button>
      {error && <Notice urgent>{error}</Notice>}
    </section>
  );
}
