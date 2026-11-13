import React, { useState } from "react";
import { Notice } from "./Notice";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Primitives/Notice", component: Notice };

export const Default = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Notice>Only recorded operations are shown.</Notice>;
  },
};

export const Urgent = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <Notice urgent>Could not read the trace store.</Notice>;
  },
};
