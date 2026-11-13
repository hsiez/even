import "../components.css";
import React from "react";
import { Timestamp } from "../Timestamp/Timestamp";
import { Duration } from "../Duration/Duration";
import { TraceStatus } from "../TraceStatus/TraceStatus";
import { CopyButton } from "../CopyButton/CopyButton";
export function TraceSummary({ trace }) {
  return (
    <section className="even-detail-section" aria-label="Trace summary">
      <h2>{trace.label ?? "Recorded execution"}</h2>
      <dl>
        <dt>Trace ID</dt>
        <dd>
          {trace.traceId}
          <CopyButton label="Copy trace ID" value={trace.traceId} />
        </dd>
        <dt>Started</dt>
        <dd>
          <Timestamp value={trace.startedAt} />
        </dd>
        <dt>Duration</dt>
        <dd>
          <Duration milliseconds={trace.durationMs} />
        </dd>
        <dt>Outcome</dt>
        <dd>
          <TraceStatus
            errorCount={trace.errorSpanCount}
            complete={trace.complete}
          />
        </dd>
        <dt>Agents</dt>
        <dd>{trace.agentNames?.join(", ") || "Unknown"}</dd>
        <dt>Trace-wide spans</dt>
        <dd>{trace.spanCount ?? trace.spans?.length ?? "Unknown"}</dd>
        <dt>Trace-wide model calls</dt>
        <dd>{trace.modelCalls ?? "Unknown"}</dd>
        <dt>Trace-wide tool calls</dt>
        <dd>{trace.toolCalls ?? "Unknown"}</dd>
      </dl>
    </section>
  );
}
