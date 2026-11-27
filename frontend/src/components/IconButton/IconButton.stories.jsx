import React, { useState } from "react";
import { IconButton } from "./IconButton";

export default { title: "Primitives/IconButton", component: IconButton };

export const Default = {
  render: function Example() {
    const [, setValue] = useState("");
    return (
      <IconButton label="Close inspector" onClick={() => setValue("Closed")}>
        ×
      </IconButton>
    );
  },
};
