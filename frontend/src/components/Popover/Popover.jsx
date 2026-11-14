import React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";

import { styledPart } from "../presentation";

const Popup = styledPart(BasePopover.Popup, "even-popup even-popover-popup");

function Content({ children, side = "bottom", align = "start", ...props }) {
  return (
    <BasePopover.Portal className="even-overlay-portal">
      <BasePopover.Positioner
        className="even-positioner"
        side={side}
        align={align}
      >
        <Popup {...props}>{children}</Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
export const Popover = Object.assign(
  function PopoverRoot(props) {
    return <BasePopover.Root {...props} />;
  },
  {
    Trigger: styledPart(BasePopover.Trigger, "even-button"),
    Content,
    Title: styledPart(BasePopover.Title, "even-popup-title"),
    Description: styledPart(BasePopover.Description, "even-help"),
    Close: styledPart(BasePopover.Close, "even-button"),
  },
);
