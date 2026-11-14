import "../components.css";
import React from "react";
import { useState, useId } from "react";
import { TextField } from "../TextField/TextField";
import { CopyButton } from "../CopyButton/CopyButton";
export function serializeValue(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}
export function AttributeList({ attributes = {} }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const entries = Object.entries(attributes).filter(([key, value]) =>
    `${key} ${serializeValue(value)}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section
      className="even-detail-section even-attributes"
      aria-label="Attributes"
    >
      <TextField
        label="Filter attributes"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!entries.length && <p role="status">No matching attributes.</p>}
      <dl>
        {entries.map(([key, value], index) => (
          <React.Fragment key={key}>
            <dt id={`${id}-${index}`}>{key}</dt>
            <dd aria-labelledby={`${id}-${index}`}>
              <pre>{serializeValue(value)}</pre>
              <CopyButton label={`Copy ${key}`} value={serializeValue(value)} />
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}
