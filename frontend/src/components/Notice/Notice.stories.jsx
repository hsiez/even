import React from "react";
import { Notice } from "./Notice";

export default { title: "Primitives/Notice", component: Notice };

export const Default = {
  render: function Example() {
    return <Notice>Only recorded operations are shown.</Notice>;
  },
};

export const Urgent = {
  render: function Example() {
    return <Notice urgent>Could not read the trace store.</Notice>;
  },
};
