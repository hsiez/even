import "../components.css";
import React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import {
  ClipboardIcon,
  ClipboardSuccessIcon,
  ClipboardErrorIcon,
} from "../icons";
export function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
  ...props
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setStatus("");
    setPending(false);
    busy.current = false;
    return () => {
      revision.current++;
    };
  }, [value]);
  async function copy() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const current = revision.current;
    try {
      await navigator.clipboard.writeText(value);
      if (current === revision.current) setStatus("Copied.");
    } catch {
      if (current === revision.current) setStatus("Copy failed. Try again.");
    } finally {
      if (current === revision.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const Control = iconOnly ? IconButton : Button;
  const failed = status.startsWith("Copy failed");
  const Icon = failed
    ? ClipboardErrorIcon
    : status
      ? ClipboardSuccessIcon
      : ClipboardIcon;
  return (
    <>
      <Control
        variant="ghost"
        size="compact"
        {...props}
        {...(iconOnly ? { label } : {})}
        pending={pending}
        onClick={copy}
      >
        {iconOnly ? (
          <Icon
            className="even-copy-icon"
            aria-hidden="true"
            focusable="false"
          />
        ) : (
          label
        )}
      </Control>
      <span
        role="status"
        className={
          iconOnly
            ? failed
              ? "even-copy-error"
              : "even-visually-hidden"
            : undefined
        }
      >
        {status}
      </span>
    </>
  );
}
