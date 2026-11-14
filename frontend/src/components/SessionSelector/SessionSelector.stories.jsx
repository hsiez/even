import React, { useState } from "react";
import { SessionSelector } from "./SessionSelector";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default {
  title: "Workbench/SessionSelector",
  component: SessionSelector,
};

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SessionSelector
        sessions={sessions}
        value={value || "session-1"}
        onValueChange={setValue}
        onCreate={() => setValue("session-2")}
      />
    );
  },
};

export const Creating = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <SessionSelector sessions={[]} creating />;
  },
};

export const Failed = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <SessionSelector
        sessions={[]}
        error="Channel unavailable"
        onCreate={() => {}}
      />
    );
  },
};
