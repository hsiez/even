import "../components.css";
import React from "react";
import { AttributeList } from "../AttributeList/AttributeList";
import { CopyButton } from "../CopyButton/CopyButton";
import { Duration } from "../Duration/Duration";
import { spanTiming } from "../SpanWaterfall/SpanWaterfall";
export function SpanDetails({ span }) {
  if (!span) return <p>Select a span to inspect.</p>;
  return (
    <section className="even-detail-section" aria-label="Span details">
      <h3>{span.name}</h3>
      <dl>
        <dt>Span ID</dt>
        <dd>
          {span.spanId}
          <CopyButton value={span.spanId} label="Copy span ID" />
        </dd>
        <dt>Duration</dt>
        <dd>
          <Duration milliseconds={spanTiming(span)?.durationMs} />
        </dd>
        <dt>Status</dt>
        <dd>
          {span.statusCode === 2
            ? "Error"
            : span.statusCode === 1
              ? "OK"
              : "Unset"}
        </dd>
      </dl>
      {span.statusMessage && <p>{span.statusMessage}</p>}
      <AttributeList attributes={span.attributes} />
    </section>
  );
}
