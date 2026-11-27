import React from "react";
import { Duration } from "./Duration";

export default { title: "Primitives/Duration", component: Duration };

export const Default = {
  render: function Example() {
    return <Duration milliseconds={4200} />;
  },
};

export const Zero = {
  render: function Example() {
    return <Duration milliseconds={0} />;
  },
};

export const Missing = {
  render: function Example() {
    return <Duration />;
  },
};
