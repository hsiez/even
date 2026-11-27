import React from "react";

export function JsonText({ text }) {
  const pattern =
    /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g;
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const kind = value.startsWith('"')
      ? /^\s*:/.test(text.slice(match.index + value.length))
        ? "key"
        : "string"
      : /^-?\d/.test(value)
        ? "number"
        : /^(true|false|null)$/.test(value)
          ? "literal"
          : "punctuation";
    parts.push(text.slice(cursor, match.index));
    parts.push(
      <span className={`even-json-${kind}`} key={match.index}>
        {value}
      </span>,
    );
    cursor = match.index + value.length;
  }
  parts.push(text.slice(cursor));
  return parts;
}
