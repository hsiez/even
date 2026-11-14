import React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { styledPart } from "../presentation";

const Root = styledPart(Collapsible.Root, "even-disclosure");
const StyledPanel = styledPart(Collapsible.Panel, "even-disclosure-panel");
function Panel(props) {
  return <StyledPanel keepMounted {...props} />;
}
export const Disclosure = Object.assign(Root, {
  Trigger: styledPart(
    Collapsible.Trigger,
    "even-button even-disclosure-trigger",
  ),
  Panel,
});
