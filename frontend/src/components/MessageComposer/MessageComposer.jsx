import "../components.css";
import React from "react";
import { useState, useId, useRef } from "react";
import { Button } from "../Button/Button";
export function MessageComposer({ onSend, disabled = false, pending = false }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const id = useId();
  async function submit(event) {
    event.preventDefault();
    if (busy.current || pending || disabled || !draft.trim()) return;
    busy.current = true;
    setSending(true);
    setError("");
    const submitted = draft;
    try {
      await onSend(submitted);
      setDraft((current) => (current === submitted ? "" : current));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not send message.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <form
      className="even-composer"
      aria-label="Message composer"
      onSubmit={submit}
    >
      <label htmlFor={id}>Message</label>
      <textarea
        className="even-input"
        id={id}
        value={draft}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p id={`${id}-help`}>Enter adds a line. Use Send message to submit.</p>
      <Button
        variant="primary"
        type="submit"
        pending={pending || sending}
        disabled={disabled || !draft.trim()}
      >
        Send message
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
