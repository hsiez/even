import React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { styledPart } from "../presentation";

const Root = styledPart(BaseTabs.Root, "even-tabs");
const StyledList = styledPart(BaseTabs.List, "even-tab-list");
const StyledPanel = styledPart(BaseTabs.Panel, "even-tab-panel");
function List({ label, ...props }) {
  return (
    <StyledList
      activateOnFocus
      {...props}
      aria-label={label ?? props["aria-label"]}
    />
  );
}
function Panel(props) {
  return <StyledPanel keepMounted {...props} />;
}

export const Tabs = Object.assign(Root, {
  List,
  Trigger: styledPart(BaseTabs.Tab, "even-tab"),
  Panel,
});
