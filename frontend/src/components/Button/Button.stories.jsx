import React, { useState } from "react";
import { Button } from "./Button";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Button", component: Button };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Button onClick={() => setValue("Refreshed")}>
        {value || "Refresh"}
      </Button>
    );
  },
};

export const Pending = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Button pending>Refreshing…</Button>;
  },
};

export const Disabled = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Button disabled>Send</Button>;
  },
};

export const VariantsAndSizes = {
  render: function Example() {
    const [lastAction, setLastAction] = useState("");
    return (
      <div style={{ display: "grid", gap: "var(--even-space-gap-group)" }}>
        {["compact", "default", "comfortable"].map((size) => (
          <div
            key={size}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--even-space-gap-related)",
            }}
          >
            {["primary", "secondary", "ghost"].map((variant) => (
              <Button
                key={variant}
                size={size}
                variant={variant}
                onClick={() => setLastAction(`${variant} ${size}`)}
              >
                {variant} {size}
              </Button>
            ))}
          </div>
        ))}
        <output>{lastAction}</output>
      </div>
    );
  },
};
