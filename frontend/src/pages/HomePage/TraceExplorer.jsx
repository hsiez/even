import React, { useCallback, useRef, useState } from "react";
import {
  Button,
  InspectorPanel,
  Notice,
  ResultsState,
  SpanDetails,
  SpanWaterfall,
  Tabs,
  TraceSummary,
  TraceSearch,
  TraceTable,
  TraceToolbar,
  WorkbenchTabs,
} from "../../components";
import "./HomePage.css";
import {
  parseTraceQuery,
  searchTraces,
  searchSuggestions,
  removeQueryToken,
  matchExcerpt,
} from "../../search/traceSearch";
import { useTraceData, useTraceDetail } from "./useTraceData";

const startedAt = (trace) =>
  trace.startedAt == null ? NaN : Date.parse(trace.startedAt);

export function TraceExplorer({
  agents = [],
  traces: suppliedTraces = [],
  loading: suppliedLoading = false,
  error: suppliedError,
  onRefresh: suppliedRefresh,
  refreshing = false,
  initialQuery = "",
  agentId = "",
  dataSource,
  active,
  tabId,
  header,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [recentQueries, setRecentQueries] = useState([]);
  const [detailTab, setDetailTab] = useState("spans");
  const [columnWidths, setColumnWidths] = useState({});
  const [selection, setSelection] = useState();
  const [requestedSpanId, setSpanId] = useState();
  const [requestedExpandedIds, setExpandedSpanIds] = useState();
  const [focusInspector, setFocusInspector] = useState(false);
  const operationRef = useRef(null);
  const scroll = useRef({ top: 0, left: 0 });
  if (!active && focusInspector) setFocusInspector(false);
  const attachView = useCallback((node) => {
    if (node) node.scrollTop = scroll.current.top;
  }, []);
  const attachTable = useCallback((node) => {
    if (node) node.scrollLeft = scroll.current.left;
  }, []);
  const remote = useTraceData(dataSource, { agentId, query });
  const traces = dataSource
    ? remote.results.map((result) => result.trace)
    : suppliedTraces;
  const loading = suppliedLoading || (!!dataSource && remote.loading);
  const error = suppliedError || (dataSource && remote.error);
  const onRefresh = dataSource ? remote.refresh : suppliedRefresh;
  const activeAgent = agents.find((agent) => agent.id === agentId);
  const scope = activeAgent
    ? traces.filter((trace) => trace.agentId === activeAgent.id)
    : traces;
  const normalizedQuery = query.trim();
  const parsed = parseTraceQuery(query);
  const searchResults = dataSource
    ? remote.results
    : searchTraces(scope, parsed);
  const matchesByTrace = new Map(
    searchResults.map((result) => [result.trace.traceId, result.matches]),
  );
  const filtered = searchResults
    .map((result) => result.trace)
    .sort((a, b) => {
      if (dataSource) return 0;
      const left = startedAt(a),
        right = startedAt(b);

      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
      if (!Number.isFinite(right)) return -1;
      return right - left;
    });
  const selectedSummary =
    (!error || dataSource) &&
    (filtered.find((trace) => trace.traceId === selection?.traceId) ??
      (dataSource ? selection?.summary : undefined));
  const detail = useTraceDetail(dataSource, agentId, selectedSummary?.traceId);
  const selected =
    selectedSummary &&
    (dataSource
      ? { ...selectedSummary, spans: detail.trace?.spans ?? [] }
      : selectedSummary);
  const spanId =
    requestedSpanId ??
    selected?.spans?.find((span) => !span.parentSpanId)?.spanId;
  const expandedSpanIds =
    requestedExpandedIds ?? expandedAncestors(selected?.spans ?? [], spanId);
  if (
    !dataSource &&
    selection &&
    (error || !traces.some((trace) => trace.traceId === selection.traceId))
  ) {
    setSelection(undefined);
    setSpanId(undefined);
    setExpandedSpanIds(undefined);
  }
  function changeFilter(update) {
    setSelection(undefined);
    setSpanId(undefined);
    update();
  }
  function clearFilters() {
    changeFilter(() => {
      setQuery("");
    });
  }
  const filters = [
    ...parsed.tokens
      .filter((token) => token.field !== "text")
      .map((token) => ({ id: `query:${token.start}`, label: token.raw })),
  ];
  const state = error
    ? "error"
    : loading
      ? "loading"
      : filtered.length
        ? "ready"
        : normalizedQuery
          ? "no-matches"
          : "empty";
  return (
    <WorkbenchTabs.Panel value={tabId}>
      {active && (
        <>
          {header}
          <div
            className="even-home-explorer"
            ref={attachView}
            onScrollCapture={(event) => {
              if (event.target === event.currentTarget)
                scroll.current.top = event.target.scrollTop;
            }}
          >
            <div className="even-home-explorer-content">
              <div className="even-home-control-area">
                <div className="even-home-controls">
                  <TraceToolbar
                    searchControl={
                      <TraceSearch
                        value={query}
                        onValueChange={(value) =>
                          changeFilter(() => setQuery(value))
                        }
                        onCommit={(value) => {
                          if (value.trim() && !parseTraceQuery(value).error)
                            setRecentQueries((previous) =>
                              [
                                value,
                                ...previous.filter((item) => item !== value),
                              ].slice(0, 3),
                            );
                        }}
                        suggestions={searchSuggestions(
                          query,
                          traces,
                          recentQueries,
                          {
                            tools: remote.suggestions?.tools,
                            agents: [
                              ...(activeAgent
                                ? [activeAgent.id, activeAgent.name]
                                : agents.flatMap((agent) => [
                                    agent.id,
                                    agent.name,
                                  ])),
                              ...(remote.suggestions?.agents ?? []),
                            ].filter(Boolean),
                          },
                        )}
                        error={parsed.error}
                      />
                    }
                    query={query}
                    onQueryChange={(value) =>
                      changeFilter(() => setQuery(value))
                    }
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    filters={filters}
                    onRemoveFilter={(id) =>
                      changeFilter(() =>
                        id.startsWith("query:")
                          ? setQuery(
                              removeQueryToken(
                                query,
                                parsed.tokens.find(
                                  (token) => `query:${token.start}` === id,
                                ),
                              ),
                            )
                          : undefined,
                      )
                    }
                    onClearFilters={clearFilters}
                  />
                  {(normalizedQuery || filters.length > 0) && (
                    <div className="even-home-control-actions">
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={clearFilters}
                      >
                        Reset view
                      </Button>
                    </div>
                  )}
                  {normalizedQuery &&
                    scope.some((trace) => trace.contentCaptured === false) && (
                      <p className="even-home-capture-note">
                        {
                          scope.filter(
                            (trace) => trace.contentCaptured === false,
                          ).length
                        }{" "}
                        {scope.filter(
                          (trace) => trace.contentCaptured === false,
                        ).length === 1
                          ? "trace has"
                          : "traces have"}{" "}
                        no captured content. Metadata is still searchable.
                      </p>
                    )}
                  {parsed.error && (
                    <p className="even-home-capture-note">
                      Finish or correct the query to see results.
                    </p>
                  )}
                </div>
              </div>
              <section
                className="even-home-results"
                aria-label="Trace explorer"
              >
                <p className="even-home-results-status" role="status">
                  {filtered.length} {filtered.length === 1 ? "trace" : "traces"}
                  {dataSource && ` loaded of ${remote.total}`}
                  {" · "}
                  {activeAgent?.name ?? activeAgent?.id ?? "All agents"}
                </p>
                {dataSource && remote.coverage?.complete === false && (
                  <Notice>
                    Search coverage is incomplete.{" "}
                    {remote.coverage.skippedTraces} traces skipped;{" "}
                    {remote.coverage.unreadableSegments} segments unreadable.
                  </Notice>
                )}
                {dataSource && remote.notice && (
                  <Notice>{remote.notice}</Notice>
                )}
                <ResultsState
                  state={parsed.error && !error && !loading ? "ready" : state}
                  error={error}
                  onRetry={onRefresh}
                />
                {dataSource && error && filtered.length > 0 && (
                  <Notice>Showing previously loaded traces.</Notice>
                )}
                {!parsed.error &&
                  (!error || dataSource) &&
                  filtered.length > 0 && (
                    <TraceTable
                      scrollRef={attachTable}
                      onScroll={(event) => {
                        if (event.target === event.currentTarget)
                          scroll.current.left = event.currentTarget.scrollLeft;
                      }}
                      traces={filtered}
                      reloads={dataSource ? remote.reloads : []}
                      columnWidths={columnWidths}
                      onColumnWidthsChange={setColumnWidths}
                      selectedTraceId={selected?.traceId}
                      selectedOperationRef={operationRef}
                      renderOperationDetail={
                        normalizedQuery
                          ? (trace) => {
                              const matches =
                                matchesByTrace.get(trace.traceId) ?? [];
                              return matches[0] ? (
                                <>
                                  <span>
                                    {matches[0].field} ·{" "}
                                    {matches[0].operation ?? "Trace metadata"}
                                    {matches.length > 1
                                      ? ` · +${matches.length - 1} matches`
                                      : ""}
                                  </span>
                                  <span>
                                    <SearchExcerpt match={matches[0]} />
                                  </span>
                                </>
                              ) : null;
                            }
                          : undefined
                      }
                      onSelectTrace={(id) => {
                        setFocusInspector(true);
                        setSelection({
                          traceId: id,
                          summary: filtered.find(
                            (trace) => trace.traceId === id,
                          ),
                        });
                        setDetailTab("spans");
                        const matchedSpan =
                          matchesByTrace.get(id)?.find((match) => match.spanId)
                            ?.spanId ??
                          filtered
                            .find((trace) => trace.traceId === id)
                            ?.spans?.find((span) => !span.parentSpanId)?.spanId;
                        setSpanId(matchedSpan);
                        setExpandedSpanIds(
                          dataSource
                            ? undefined
                            : expandedAncestors(
                                filtered.find((trace) => trace.traceId === id)
                                  ?.spans ?? [],
                                matchedSpan,
                              ),
                        );
                      }}
                    />
                  )}
                {dataSource && remote.nextCursor && (
                  <Button pending={remote.loading} onClick={remote.loadMore}>
                    Load more traces
                  </Button>
                )}
              </section>
            </div>
            <InspectorPanel
              open={!!selected}
              autoFocus={focusInspector}
              returnFocusRef={operationRef}
              onClose={() => setSelection(undefined)}
            >
              <InspectorPanel.Header>
                <h2>Inspect execution</h2>
                <InspectorPanel.Close />
              </InspectorPanel.Header>
              <InspectorPanel.Body>
                {selected && (
                  <>
                    <p className="even-home-inspector-title">
                      {selected.label ?? selected.traceId}
                    </p>
                    {detail.loading && <Notice>Loading trace details…</Notice>}
                    {detail.error && (
                      <Notice
                        urgent
                        action={
                          <Button onClick={detail.refresh}>
                            Retry trace details
                          </Button>
                        }
                      >
                        {detail.error}
                      </Notice>
                    )}
                    <SpanWaterfall
                      key={selected.traceId}
                      spans={selected.spans ?? []}
                      selectedSpanId={spanId}
                      onSelectSpan={setSpanId}
                      expandedSpanIds={expandedSpanIds}
                      onExpandedChange={setExpandedSpanIds}
                    >
                      <Tabs value={detailTab} onValueChange={setDetailTab}>
                        <Tabs.List label="Execution detail views">
                          <Tabs.Trigger value="spans">Spans</Tabs.Trigger>
                          <Tabs.Trigger value="timing">Timing</Tabs.Trigger>
                          <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
                        </Tabs.List>
                        <Tabs.Panel value="spans">
                          {(selected.spans ?? []).length ? (
                            <SpanWaterfall.Tree />
                          ) : !detail.loading && !detail.error ? (
                            <p>No spans were captured.</p>
                          ) : null}
                          {(matchesByTrace.get(selected.traceId) ?? []).some(
                            (match) => match.spanId,
                          ) && (
                            <section
                              className="even-home-match-evidence"
                              aria-label="Search match evidence"
                            >
                              <h3>Why this trace matched</h3>
                              <ul>
                                {matchesByTrace
                                  .get(selected.traceId)
                                  .filter((match) => match.spanId)
                                  .map((match, index) => (
                                    <li
                                      key={`${match.spanId}-${match.field}-${index}`}
                                    >
                                      <Button
                                        size="compact"
                                        variant="ghost"
                                        aria-pressed={spanId === match.spanId}
                                        onClick={() => {
                                          setSpanId(match.spanId);
                                          setExpandedSpanIds((previous) => [
                                            ...new Set([
                                              ...(previous ?? expandedSpanIds),
                                              ...expandedAncestors(
                                                selected.spans ?? [],
                                                match.spanId,
                                              ),
                                            ]),
                                          ]);
                                        }}
                                      >
                                        {match.field} ·{" "}
                                        {match.operation ?? "Recorded error"}
                                      </Button>
                                      <p>
                                        <SearchExcerpt match={match} />
                                      </p>
                                      {match.source && (
                                        <small>{match.source}</small>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </section>
                          )}
                          <SpanDetails
                            span={selected.spans?.find(
                              (span) => span.spanId === spanId,
                            )}
                          />
                        </Tabs.Panel>
                        <Tabs.Panel value="timing">
                          <SpanWaterfall.Timeline />
                        </Tabs.Panel>
                        <Tabs.Panel value="summary">
                          <TraceSummary trace={selected} />
                        </Tabs.Panel>
                      </Tabs>
                    </SpanWaterfall>
                  </>
                )}
              </InspectorPanel.Body>
            </InspectorPanel>
          </div>
        </>
      )}
    </WorkbenchTabs.Panel>
  );
}

function SearchExcerpt({ match }) {
  const { text, term } = matchExcerpt(match);
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  return at < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

function expandedAncestors(spans, selectedId) {
  const expanded = new Set(
    spans.filter((span) => !span.parentSpanId).map((span) => span.spanId),
  );
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const visited = new Set();
  let current = byId.get(selectedId);
  while (current?.parentSpanId && !visited.has(current.spanId)) {
    visited.add(current.spanId);
    expanded.add(current.parentSpanId);
    current = byId.get(current.parentSpanId);
  }
  return [...expanded];
}
