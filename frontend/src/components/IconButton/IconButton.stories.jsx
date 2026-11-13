import React, { useState } from "react";
import { IconButton } from "./IconButton";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/IconButton", component: IconButton };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <IconButton label="Close inspector" onClick={() => setValue("Closed")}>
        ×
      </IconButton>
    );
  },
};
