import React from "react";
import { PayloadViewer } from "../PayloadViewer/PayloadViewer";
import { Notice } from "../Notice/Notice";
import { Button } from "../Button/Button";
import { CopyButton } from "../CopyButton/CopyButton";
import { serializeValue } from "../AttributeList/AttributeList";
import { classes } from "../presentation";
import { Duration } from "../Duration/Duration";
import { spanTiming } from "../SpanWaterfall/SpanWaterfall";
import { traceTokenUsage } from "../../traces/traceModel";

export function TraceRawPanel({
  span,
  tokenUsage,
  loading = false,
  error,
  onRetry,
  className,
  ...props
}) {
  const usage =
    tokenUsage ?? (span ? traceTokenUsage([span]).get(span.spanId) : undefined);
  return (
    <section
      {...props}
      className={classes("even-trace-raw-panel", className)}
      aria-label="Raw span inspector"
      aria-busy={loading || undefined}
    >
      {error ? (
        <Notice
          urgent
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        >
          {error}
        </Notice>
      ) : loading ? (
        <Notice>Loading span…</Notice>
      ) : span ? (
        <PayloadViewer
          key={span.spanId}
          value={span}
          label="raw span JSON"
          highlightJson
          showCopyButton={false}
          toolbar={
            <>
              <div
                className="even-trace-raw-metrics"
                role="group"
                aria-label="Selected span metrics"
              >
                <Duration milliseconds={spanTiming(span)?.durationMs} />{" "}
                {usage && (
                  <span>
                    {usage.partial ? "≥" : ""}
                    {usage.count.toLocaleString("en-US")} tokens
                  </span>
                )}
              </div>
              <span className="even-trace-raw-format">JSON</span>
              <CopyButton
                iconOnly
                value={serializeValue(span)}
                label="Copy raw span JSON"
              />
            </>
          }
        />
      ) : (
        <p className="even-trace-empty">
          Select a span in the execution path to inspect its JSON.
        </p>
      )}
    </section>
  );
}
