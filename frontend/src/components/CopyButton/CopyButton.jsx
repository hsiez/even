import "../components.css";
import React from "react";
import { useState, useRef } from "react";
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
  const fresh = () => ({ value, status: "", pending: false, token: {} });
  const [request, setRequest] = useState(fresh);
  const busy = useRef(null);
  if (request.value !== value) setRequest(fresh());
  const { status, pending, token } = request;
  function update(next) {
    setRequest((current) =>
      current.token === token ? { ...current, ...next } : current,
    );
  }
  async function copy() {
    if (busy.current === token) return;
    busy.current = token;
    update({ pending: true });
    try {
      await navigator.clipboard.writeText(value);
      update({ status: "Copied." });
    } catch {
      update({ status: "Copy failed. Try again." });
    } finally {
      if (busy.current === token) busy.current = null;
      update({ pending: false });
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
