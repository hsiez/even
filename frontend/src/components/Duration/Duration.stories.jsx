import React, { useState } from "react";
import { Duration } from "./Duration";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Duration", component: Duration };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Duration milliseconds={4200} />;
  },
};

export const Zero = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Duration milliseconds={0} />;
  },
};

export const Missing = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Duration />;
  },
};
