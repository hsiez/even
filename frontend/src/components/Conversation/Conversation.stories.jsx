import React, { useState } from "react";
import { Conversation } from "./Conversation";
import { ViewExecutionAction } from "../ViewExecutionAction/ViewExecutionAction";
import { Button } from "../Button/Button";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/Conversation", component: Conversation };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Conversation
        messages={[
          { id: "1", role: "user", content: "Why did deployment fail?" },
          {
            id: "2",
            role: "agent",
            content: "The logs indicate a permissions error.",
          },
        ]}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Conversation />;
  },
};

export const UpdatedMessage = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Conversation
        messages={[
          { id: "1", role: "agent", content: "Checking" },
          { id: "1", role: "agent", content: "Checking deployment logs…" },
        ]}
      />
    );
  },
};

export const LateExecutionLinks = {
  render: function Example() {
    const [ready, setReady] = useState(false);
    return (
      <div
        style={{ width: "min(100%, var(--even-size-navigation-preferred))" }}
      >
        <Button onClick={() => setReady((previous) => !previous)}>
          {ready ? "Reset execution links" : "Resolve execution links"}
        </Button>
        <Conversation
          messages={Array.from({ length: 15 }, (_, index) => ({
            id: `fixture-${index}`,
            role: "agent",
            content: `Fixture message ${index + 1}`,
            executionAction:
              index === 14 ? (
                <ViewExecutionAction
                  pending={!ready}
                  traces={
                    ready
                      ? ["one", "two", "three"].map((traceId) => ({ traceId }))
                      : []
                  }
                  hrefForTrace={(id) => `#fixture-${id}`}
                />
              ) : undefined,
          }))}
        />
      </div>
    );
  },
};
