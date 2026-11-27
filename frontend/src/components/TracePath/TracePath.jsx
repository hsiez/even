import React, { useRef } from "react";
import { SpanWaterfall } from "../SpanWaterfall/SpanWaterfall";
import { TraceObject } from "../TraceObject/TraceObject";
import { classes } from "../presentation";
import { OpenExecutionIcon } from "../icons";
import { describeSpan, pathSpans } from "../../traces/traceModel";
import { TraceRail } from "./TraceRail";

export function TracePath({
  spans = [],
  selectedSpanId,
  defaultSelectedSpanId,
  onSelectSpan,
  currentActivationId = spans.find(
    (span) =>
      describeSpan(span).activation &&
      !spans.some((parent) => parent.spanId === span.parentSpanId),
  )?.spanId,
  expandedSpanIds,
  defaultExpandedSpanIds = [],
  onExpandedChange,
  className,
  label = "Execution path",
  categoryAppearance = "plain",
  ...props
}) {
  const contentRef = useRef(null);
  const visibleSpans = pathSpans(spans, currentActivationId);
  return (
    <section
      {...props}
      className={classes("even-trace-path", className)}
      aria-label={label}
    >
      {!visibleSpans.length ? (
        <p className="even-trace-empty">
          {spans.length
            ? "No operations recorded in this execution."
            : "No spans recorded."}
        </p>
      ) : (
        <div className="even-trace-path-content" ref={contentRef}>
          <SpanWaterfall
            spans={visibleSpans}
            selectedSpanId={selectedSpanId}
            defaultSelectedSpanId={defaultSelectedSpanId}
            expandedSpanIds={expandedSpanIds}
            defaultExpandedSpanIds={defaultExpandedSpanIds}
            onExpandedChange={onExpandedChange}
          >
            <TraceRail contentRef={contentRef} />
            <SpanWaterfall.Tree
              onActivateSpan={onSelectSpan}
              label={label}
              className="even-trace-path-tree"
              getLabel={(span) => describeSpan(span).label}
              renderToggle={() => (
                <span className="even-trace-path-node" aria-hidden="true">
                  <span className="even-trace-path-marker" />
                </span>
              )}
              getDescription={(span) => {
                const description = describeSpan(span);
                const type = description.activation
                  ? "Subagent"
                  : description.kind;
                return `${type}.${span.statusCode === 2 ? " Error." : ""}${description.activation && span.spanId !== currentActivationId ? " Press Enter to open this agent execution." : ""}`;
              }}
              renderLabel={(span, { hasChildren }) => {
                return (
                  <>
                    {!hasChildren && (
                      <span className="even-trace-path-node" aria-hidden="true">
                        <span className="even-trace-path-marker" />
                      </span>
                    )}
                    <TraceObject
                      span={span}
                      categoryAppearance={categoryAppearance}
                      category={
                        describeSpan(span).activation ? "Subagent" : undefined
                      }
                    />
                    {describeSpan(span).activation &&
                      span.spanId !== currentActivationId && (
                        <OpenExecutionIcon
                          className="even-trace-open-icon"
                          aria-hidden="true"
                          focusable="false"
                        />
                      )}
                  </>
                );
              }}
            />
          </SpanWaterfall>
        </div>
      )}
    </section>
  );
}
