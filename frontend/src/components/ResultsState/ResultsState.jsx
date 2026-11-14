import React from "react";
import { Button } from "../Button/Button";
import { Notice } from "../Notice/Notice";
export function ResultsState({ state = "ready", error, onRetry, children }) {
  if (state === "loading")
    return (
      <div aria-busy="true">
        <Notice>Loading results…</Notice>
        {children}
      </div>
    );
  if (state === "error")
    return (
      <Notice
        urgent
        action={onRetry && <Button onClick={onRetry}>Retry</Button>}
      >
        {error || "Could not load results."}
      </Notice>
    );
  if (state === "empty") return <Notice>No recorded traces yet.</Notice>;
  if (state === "no-matches")
    return <Notice>No traces match these filters.</Notice>;
  return children;
}
