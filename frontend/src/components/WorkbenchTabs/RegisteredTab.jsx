import React, { useCallback } from "react";
import { WorkbenchTabs } from "./WorkbenchTabs";

export function RegisteredTab({ nodeKey, register, ...props }) {
  const attach = useCallback(
    (node) => {
      register(nodeKey, node);
    },
    [nodeKey, register],
  );
  return <WorkbenchTabs.Tab {...props} ref={attach} />;
}
