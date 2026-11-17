import React, { useEffect, useId, useState } from "react";
import {
  Button,
  InspectorPanel,
  ResultsState,
  Sidebar,
  SpanDetails,
  SpanWaterfall,
  Tabs,
  TraceSummary,
  TraceSearch,
  TraceTable,
  TraceToolbar,
  WorkbenchLayout,
} from "../../components";
import "./HomePage.css";
import {
  parseTraceQuery,
  searchTraces,
  searchSuggestions,
  removeQueryToken,
  matchExcerpt,
} from "../../search/traceSearch";

const sortValue = (trace, key) =>
  key === "startedAt"
    ? trace.startedAt == null
      ? NaN
      : Date.parse(trace.startedAt)
    : trace.durationMs == null || trace.durationMs < 0
      ? NaN
      : trace.durationMs;

// The page coordinates supplied view models. Generic controls own their interactions.
export function HomePage({
  workspaceName = "Workspace",
  agents = [],
  traces = [],
  actions,
  dataLabel,
  loading = false,
  error,
  onRefresh,
  refreshing = false,
  initialQuery = "",
}) {
  const agentsLabel = useId();
  const [agentId, setAgentId] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [recentQueries, setRecentQueries] = useState([]);
  const [detailTab, setDetailTab] = useState("spans");
  const [sort, setSort] = useState({
    key: "startedAt",
    direction: "descending",
  });
  const [selection, setSelection] = useState();
  const [spanId, setSpanId] = useState();
  const [expandedSpanIds, setExpandedSpanIds] = useState([]);
  const activeAgent = agents.find((agent) => agent.id === agentId);
  const scope = activeAgent
    ? traces.filter((trace) => trace.agentId === activeAgent.id)
    : traces;
  const normalizedQuery = query.trim();
  const parsed = parseTraceQuery(query);
  const searchResults = searchTraces(scope, parsed);
  const matchesByTrace = new Map(
    searchResults.map((result) => [result.trace.traceId, result.matches]),
  );
  const filtered = searchResults
    .map((result) => result.trace)
    .sort((a, b) => {
      const left = sortValue(a, sort.key),
        right = sortValue(b, sort.key);
      // Missing timings remain last in either direction.
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
      if (!Number.isFinite(right)) return -1;
      return (sort.direction === "ascending" ? 1 : -1) * (left - right);
    });
  const selected =
    !error && filtered.find((trace) => trace.traceId === selection);
  useEffect(() => {
    if (
      selection &&
      (error || !traces.some((trace) => trace.traceId === selection))
    ) {
      setSelection(undefined);
      setSpanId(undefined);
    }
  }, [error, traces, selection]);
  function changeFilter(update) {
    setSelection(undefined);
    setSpanId(undefined);
    update();
  }
  function clearFilters() {
    changeFilter(() => {
      setAgentId("");
      setQuery("");
    });
  }
  const filters = [
    ...parsed.tokens
      .filter((token) => token.field !== "text")
      .map((token) => ({ id: `query:${token.start}`, label: token.raw })),
    ...(activeAgent
      ? [{ id: "agent", label: activeAgent.name ?? activeAgent.id }]
      : []),
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
    <WorkbenchLayout
      className="even-home"
      navigation={
        <Sidebar className="even-home-sidebar" label="Workspace navigation">
          <div className="even-home-brand">
            <span className="even-home-mark" aria-hidden="true">
              e
            </span>
            <span>even</span>
          </div>
          <div className="even-home-workspace">
            <span>Workspace</span>
            <strong>{workspaceName}</strong>
          </div>
          <div className="even-home-agent-heading">
            <h2 id={agentsLabel}>Agents</h2>
            <span>{agents.length}</span>
          </div>
          <ul className="even-home-agents" aria-labelledby={agentsLabel}>
            <li>
              <Button
                variant="ghost"
                aria-pressed={!activeAgent}
                onClick={() => changeFilter(() => setAgentId(""))}
              >
                <span>All agents</span>
                <span className="even-home-count" aria-hidden="true">
                  {traces.length}
                </span>
              </Button>
            </li>
            {agents.map((agent) => (
              <li key={agent.id}>
                <Button
                  variant="ghost"
                  aria-pressed={activeAgent?.id === agent.id}
                  onClick={() => changeFilter(() => setAgentId(agent.id))}
                >
                  <span>{agent.name ?? agent.id}</span>
                  <span className="even-home-count" aria-hidden="true">
                    {
                      traces.filter((trace) => trace.agentId === agent.id)
                        .length
                    }
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <p className="even-home-sidebar-note">
            Inspect the execution behind every response.
          </p>
        </Sidebar>
      }
      inspector={
        <InspectorPanel
          open={!!selected}
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
                      ) : (
                        <p>No spans were captured.</p>
                      )}
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
                                          ...previous,
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
      }
    >
      <div className="even-home-control-area">
        <header className="even-home-header">
          <div>
            <p className="even-home-breadcrumb">
              {workspaceName}
              <span aria-hidden="true"> / </span>Observability
            </p>
            <div className="even-home-title">
              <h1>Traces</h1>
              {dataLabel && (
                <span className="even-home-data-label">{dataLabel}</span>
              )}
            </div>
          </div>
          <div className="even-home-actions">{actions}</div>
        </header>
        <div className="even-home-controls">
          <TraceToolbar
            searchControl={
              <TraceSearch
                value={query}
                onValueChange={(value) => changeFilter(() => setQuery(value))}
                onCommit={(value) => {
                  if (value.trim() && !parseTraceQuery(value).error)
                    setRecentQueries((previous) =>
                      [
                        value,
                        ...previous.filter((item) => item !== value),
                      ].slice(0, 3),
                    );
                }}
                suggestions={searchSuggestions(query, traces, recentQueries)}
                error={parsed.error}
              />
            }
            query={query}
            onQueryChange={(value) => changeFilter(() => setQuery(value))}
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
                  : setAgentId(""),
              )
            }
            onClearFilters={clearFilters}
          />
          {(normalizedQuery || filters.length > 0) && (
            <div className="even-home-control-actions">
              <Button variant="ghost" size="compact" onClick={clearFilters}>
                Reset view
              </Button>
            </div>
          )}
          {normalizedQuery &&
            scope.some((trace) => trace.contentCaptured === false) && (
              <p className="even-home-capture-note">
                {
                  scope.filter((trace) => trace.contentCaptured === false)
                    .length
                }{" "}
                {scope.filter((trace) => trace.contentCaptured === false)
                  .length === 1
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
      <section className="even-home-results" aria-label="Trace explorer">
        <p className="even-home-results-status" role="status">
          {filtered.length} {filtered.length === 1 ? "trace" : "traces"}
          {" · "}
          {activeAgent?.name ?? activeAgent?.id ?? "All agents"}
        </p>
        <ResultsState
          state={parsed.error && !error && !loading ? "ready" : state}
          error={error}
          onRetry={onRefresh}
        >
          {!parsed.error && (!loading || traces.length > 0) && (
            <TraceTable
              traces={filtered}
              sort={sort}
              onSortChange={setSort}
              selectedTraceId={selected?.traceId}
              renderOperationDetail={
                normalizedQuery
                  ? (trace) => {
                      const matches = matchesByTrace.get(trace.traceId) ?? [];
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
                setSelection(id);
                setDetailTab("spans");
                const matchedSpan =
                  matchesByTrace.get(id)?.find((match) => match.spanId)
                    ?.spanId ??
                  filtered
                    .find((trace) => trace.traceId === id)
                    ?.spans?.find((span) => !span.parentSpanId)?.spanId;
                setSpanId(matchedSpan);
                setExpandedSpanIds(
                  expandedAncestors(
                    filtered.find((trace) => trace.traceId === id)?.spans ?? [],
                    matchedSpan,
                  ),
                );
              }}
            />
          )}
        </ResultsState>
      </section>
    </WorkbenchLayout>
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
