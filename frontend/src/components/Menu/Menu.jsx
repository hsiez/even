import React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";

import { styledPart } from "../presentation";

const Popup = styledPart(BaseMenu.Popup, "even-popup even-menu-popup");

function Content({ children, side = "bottom", align = "start", ...props }) {
  return (
    <BaseMenu.Portal className="even-overlay-portal">
      <BaseMenu.Positioner
        className="even-positioner"
        side={side}
        align={align}
      >
        <Popup {...props}>{children}</Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}
export const Menu = Object.assign(
  function MenuRoot(props) {
    return <BaseMenu.Root {...props} />;
  },
  {
    Trigger: styledPart(BaseMenu.Trigger, "even-button"),
    Content,
    Item: styledPart(BaseMenu.Item, "even-menu-item"),
    Group: BaseMenu.Group,
    GroupLabel: styledPart(BaseMenu.GroupLabel, "even-menu-label"),
    Separator: styledPart(BaseMenu.Separator, "even-separator"),
  },
);
