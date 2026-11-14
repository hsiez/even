import React, { useState } from "react";
import { MessageComposer } from "./MessageComposer";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default {
  title: "Workbench/MessageComposer",
  component: MessageComposer,
};

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <MessageComposer
        onSend={async (message) => {
          setValue(message);
        }}
      />
    );
  },
};

export const Failure = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <MessageComposer
        onSend={async () => {
          throw new Error("Channel unavailable");
        }}
      />
    );
  },
};

export const Disabled = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <MessageComposer disabled />;
  },
};

export const Pending = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <MessageComposer pending />;
  },
};
