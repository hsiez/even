import React, { useState } from "react";
import { Select } from "./Select";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Select", component: Select };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Select
        label="Outcome"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "", label: "Any outcome" },
          { value: "error", label: "Errors" },
          { value: "ok", label: "Successful", disabled: true },
        ]}
      />
    );
  },
};
