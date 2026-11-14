import "../components.css";
import React from "react";
import { CopyButton } from "../CopyButton/CopyButton";
import { serializeValue } from "../AttributeList/AttributeList";
export function PayloadViewer({ value, label = "Payload" }) {
  if (value === undefined)
    return (
      <section className="even-payload" aria-label={label}>
        <p>Not captured.</p>
      </section>
    );
  let text = serializeValue(value);
  if (typeof value === "string") {
    try {
      text = serializeValue(JSON.parse(value));
    } catch {
      /* Plain text is valid payload content. */
    }
  }
  return (
    <section className="even-payload" aria-label={label}>
      {text === "" ? <p>Empty content.</p> : <pre>{text}</pre>}
      <CopyButton value={serializeValue(value)} label={`Copy ${label}`} />
    </section>
  );
}
