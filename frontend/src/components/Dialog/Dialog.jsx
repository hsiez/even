import React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

import { styledPart } from "../presentation";

const Popup = styledPart(BaseDialog.Popup, "even-popup even-dialog-popup");

function Content({ children, ...props }) {
  return (
    <BaseDialog.Portal className="even-overlay-portal">
      <BaseDialog.Backdrop className="even-dialog-backdrop" />
      <BaseDialog.Viewport className="even-dialog-viewport">
        <Popup {...props}>{children}</Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}
export const Dialog = Object.assign(
  function DialogRoot(props) {
    return <BaseDialog.Root {...props} />;
  },
  {
    Trigger: styledPart(BaseDialog.Trigger, "even-button"),
    Content,
    Title: styledPart(BaseDialog.Title, "even-popup-title"),
    Description: styledPart(BaseDialog.Description, "even-help"),
    Close: styledPart(BaseDialog.Close, "even-button"),
  },
);
