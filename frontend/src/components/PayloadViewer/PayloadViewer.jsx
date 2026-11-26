import "../components.css";
import React from "react";
import { CopyButton } from "../CopyButton/CopyButton";
import { serializeValue } from "../AttributeList/AttributeList";
import { JsonText } from "./JsonText";
export function PayloadViewer({
  value,
  label = "Payload",
  highlightJson = false,
  toolbar,
  showCopyButton = true,
}) {
  if (value === undefined)
    return (
      <section className="even-payload" aria-label={label}>
        <p>Not captured.</p>
      </section>
    );
  let text = serializeValue(value);
  let json = typeof value !== "string";
  if (typeof value === "string") {
    try {
      text = serializeValue(JSON.parse(value));
      json = true;
    } catch {
      /* Plain text is valid payload content. */
    }
  }
  return (
    <section className="even-payload" aria-label={label}>
      {toolbar && <div className="even-payload-toolbar">{toolbar}</div>}
      {text === "" ? (
        <p>Empty content.</p>
      ) : (
        <pre
          tabIndex={highlightJson ? 0 : undefined}
          role={highlightJson ? "region" : undefined}
          aria-label={highlightJson ? `${label} content` : undefined}
        >
          {highlightJson && json ? <JsonText text={text} /> : text}
        </pre>
      )}
      {showCopyButton && (
        <CopyButton value={serializeValue(value)} label={`Copy ${label}`} />
      )}
    </section>
  );
}
