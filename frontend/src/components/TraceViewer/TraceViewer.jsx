import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TraceBreadcrumbs } from "../TraceBreadcrumbs/TraceBreadcrumbs";
import { TracePath } from "../TracePath/TracePath";
import { TraceRawPanel } from "../TraceRawPanel/TraceRawPanel";
import { Notice } from "../Notice/Notice";
import { Button } from "../Button/Button";
import { classes } from "../presentation";
import {
  describeSpan,
  pathSpans,
  traceScopes,
  traceTokenUsage,
} from "../../traces/traceModel";
import { ScopeMotion } from "./ScopeMotion";

const Context = createContext(null);
function useViewer() {
  const context = useContext(Context);
  if (!context) throw new Error("TraceViewer parts require <TraceViewer>.");
  return context;
}
function Controller({
  trace,
  initialActivationId,
  defaultSelectedSpanId,
  loading = false,
  error,
  onRetry,
  children,
  className,
  ref,
  ...props
}) {
  const spans = trace?.spans ?? [];
  const model = useMemo(() => traceScopes(spans), [spans]);
  const usage = useMemo(() => traceTokenUsage(spans), [spans]);
  const [requestedScope, setScope] = useState(initialActivationId);
  const scopeId = model.scopes.has(requestedScope)
    ? requestedScope
    : (model.initial ?? "trace");
  const scopedSpans = model.scopeSpans(scopeId);
  const [views, setViews] = useState({});
  const scrollPositions = useRef(new Map());
  const focusRequested = useRef(false);
  const view = views[scopeId] ?? {
    selected: scopedSpans.some((span) => span.spanId === defaultSelectedSpanId)
      ? defaultSelectedSpanId
      : (pathSpans(scopedSpans, scopeId)[0]?.spanId ?? scopedSpans[0]?.spanId),
    expanded: scopedSpans
      .filter(
        (span) => !describeSpan(span).activation || span.spanId === scopeId,
      )
      .map((span) => span.spanId),
  };
  function updateView(update) {
    setViews((previous) => ({
      ...previous,
      [scopeId]: { ...view, ...update },
    }));
  }
  function navigate(id) {
    if (id === scopeId || !model.scopes.has(id)) return;
    // Retain the outgoing default too, before its children unmount.
    const entering =
      model.scopes.get(id).path.length >
      (model.scopes.get(scopeId)?.path.length ?? 0);
    setViews((previous) => ({
      ...previous,
      [scopeId]: entering ? { ...view, selected: id } : view,
    }));
    focusRequested.current = true;
    setScope(id);
  }
  const selected = scopedSpans.find((span) => span.spanId === view.selected);
  const ancestry = model.scopes.get(scopeId)?.path ?? [];
  const items = ancestry.length
    ? ancestry.map((span) => ({
        id: span.spanId,
        label: describeSpan(span).label,
      }))
    : [{ id: "trace", label: trace?.label ?? "Trace" }];
  const value = {
    scopedSpans,
    scopeId,
    selected,
    tokenUsage: usage.get(selected?.spanId),
    view,
    updateView,
    navigate,
    items,
    loading,
    error,
    onRetry,
    scrollPositions,
    focusRequested,
  };
  return (
    <Context.Provider value={value}>
      <ScopeMotion
        {...props}
        elementRef={ref}
        scopeId={scopeId}
        depth={items.length}
        aria-label={props["aria-label"] ?? "Trace viewer"}
        className={classes("even-trace-viewer", className)}
      >
        {children ?? (
          <>
            <Breadcrumbs />
            <Path />
            <Raw />
          </>
        )}
        <span className="even-visually-hidden" role="status">
          Viewing {items.at(-1)?.label} execution
        </span>
      </ScopeMotion>
    </Context.Provider>
  );
}
function Root(props) {
  // Each trace owns an independent drill-in history; another trace resets it.
  return <Controller key={props.trace?.traceId ?? "empty"} {...props} />;
}
function Breadcrumbs(props) {
  const { items, navigate, scopedSpans, scopeId, updateView } = useViewer();
  return (
    <TraceBreadcrumbs
      {...props}
      showBack
      items={items}
      onNavigate={navigate}
      onSelectCurrent={
        scopedSpans.some((span) => span.spanId === scopeId)
          ? (id) => updateView({ selected: id })
          : undefined
      }
    />
  );
}
function Path(props) {
  const {
    scopedSpans,
    scopeId,
    view,
    updateView,
    navigate,
    loading,
    error,
    onRetry,
    scrollPositions,
    focusRequested,
  } = useViewer();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const position = scrollPositions.current.get(scopeId);
    node.scrollTop = position?.top ?? 0;
    node.scrollLeft = position?.left ?? 0;
    if (focusRequested.current) {
      const target =
        [...node.querySelectorAll('[role="treeitem"]')].find(
          (item) => item.dataset.spanId === view.selected,
        ) ?? node.querySelector('[role="treeitem"]');
      target?.focus({ preventScroll: true });
      focusRequested.current = false;
    }
  }, [scopeId]);
  return (
    <div
      className="even-trace-viewer-path"
      data-trace-surface="path"
      ref={ref}
      onScroll={(event) => {
        if (event.target === event.currentTarget)
          scrollPositions.current.set(scopeId, {
            top: event.currentTarget.scrollTop,
            left: event.currentTarget.scrollLeft,
          });
      }}
    >
      {error ? (
        <Notice
          urgent
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        >
          {error}
        </Notice>
      ) : loading ? (
        <Notice>Loading execution path…</Notice>
      ) : (
        <TracePath
          {...props}
          spans={scopedSpans}
          selectedSpanId={view.selected}
          expandedSpanIds={view.expanded}
          currentActivationId={scopeId}
          onExpandedChange={(expanded) => updateView({ expanded })}
          onSelectSpan={(id) => {
            const span = scopedSpans.find((span) => span.spanId === id);
            if (span && describeSpan(span).activation && id !== scopeId)
              navigate(id);
            else updateView({ selected: id });
          }}
        />
      )}
    </div>
  );
}
function Raw(props) {
  const {
    selected,
    tokenUsage,
    loading,
    error,
    onRetry,
    scopeId,
    scrollPositions,
  } = useViewer();
  const ref = useRef(null);
  const key = JSON.stringify(["raw", scopeId, selected?.spanId]);
  useLayoutEffect(() => {
    const node = ref.current.querySelector("pre");
    const position = scrollPositions.current.get(key);
    if (node && position) {
      node.scrollTop = position.top;
      node.scrollLeft = position.left;
    }
  }, [key, loading, error]);
  return (
    <div
      className="even-trace-viewer-raw"
      data-trace-surface="raw"
      ref={ref}
      onScrollCapture={(event) => {
        if (event.target.tagName === "PRE")
          scrollPositions.current.set(key, {
            top: event.target.scrollTop,
            left: event.target.scrollLeft,
          });
      }}
    >
      <TraceRawPanel
        {...props}
        span={selected}
        tokenUsage={tokenUsage}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />
    </div>
  );
}
export const TraceViewer = Object.assign(Root, { Breadcrumbs, Path, Raw });
