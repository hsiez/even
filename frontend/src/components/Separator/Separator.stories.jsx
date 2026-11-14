import React, { useState } from "react";
import { Separator } from "./Separator";
export default { title: "Primitives/Separator", component: Separator };
export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <>
        <div>
          <p>Trace controls</p>
          <Separator />
          <p>Recorded results</p>
        </div>
        <output>{value}</output>
      </>
    );
  },
};
