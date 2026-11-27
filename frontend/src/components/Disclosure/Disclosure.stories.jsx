import React, { useState } from "react";
import { Disclosure } from "./Disclosure";

export default { title: "Primitives/Disclosure", component: Disclosure };

export const Default = {
  render: function Example() {
    return (
      <Disclosure>
        <header>
          <Disclosure.Trigger>Trace details</Disclosure.Trigger>
        </header>
        <Disclosure.Panel>Recorded execution details</Disclosure.Panel>
      </Disclosure>
    );
  },
};

export const Controlled = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <Disclosure
        open={value === "open"}
        onOpenChange={(open) => setValue(open ? "open" : "closed")}
      >
        <Disclosure.Trigger>Controlled details</Disclosure.Trigger>
        <Disclosure.Panel>Panel content</Disclosure.Panel>
      </Disclosure>
    );
  },
};
