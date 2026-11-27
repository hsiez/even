import React, { useState } from "react";
import { MessageComposer } from "./MessageComposer";

export default {
  title: "Workbench/MessageComposer",
  component: MessageComposer,
};

export const Default = {
  render: function Example() {
    const [, setValue] = useState("");
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
    return <MessageComposer disabled />;
  },
};

export const Pending = {
  render: function Example() {
    return <MessageComposer pending />;
  },
};
