import "../components.css";
import React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "../Button/Button";
export function CopyButton({ value, label = "Copy", ...props }) {
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
  return (
    <>
      <Button
        variant="ghost"
        size="compact"
        {...props}
        pending={pending}
        onClick={copy}
      >
        {label}
      </Button>
      <span role="status">{status}</span>
    </>
  );
}
