import React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { styledPart } from "../presentation";

const Popup = styledPart(BaseTooltip.Popup, "even-popup even-tooltip-popup");

function Content({ children, side = "top", ...props }) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner className="even-positioner" side={side}>
        <Popup {...props}>{children}</Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}
export const Tooltip = Object.assign(
  function TooltipRoot(props) {
    return <BaseTooltip.Root {...props} />;
  },
  {
    Provider: BaseTooltip.Provider,
    Trigger: styledPart(BaseTooltip.Trigger, "even-button"),
    Content,
  },
);
