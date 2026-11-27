import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { parseTraceQuery } from "../../search/traceSearch";

const empty = {
  results: [],
  total: 0,
  nextCursor: null,
  reloads: [],
  loading: false,
};

export function useTraceData(source, { agentId, query }) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(empty);
  const actions = useRef({});
  const [metadata, setMetadata] = useState(() => ({
    source,
    agents: new Map(),
  }));
  const resource = JSON.stringify([agentId, query]);
  const key = JSON.stringify([resource, version]);
  const request = useMemo(
    () => ({ source, agentId, query, version }),
    [source, agentId, query, version],
  );
  const compatible = state.source === source && state.resource === resource;
  const retained = useEffectEvent(() => ({ compatible, state }));
  const valid = !!source && !!agentId && !parseTraceQuery(query).error;
  useEffect(() => {
    actions.current = {};
    if (!valid) return;
    const previous = retained();
    let alive = true,
      busy = false,
      controller;

    let current = {
      ...(previous.compatible ? previous.state : empty),
      key,
      request,
      resource,
      source,
      loading: true,
      error: undefined,
    };
    const publish = (next) => {
      current = next;
      if (alive) setState(next);
    };
    async function load(cursor, append = false, notice) {
      if (!alive || busy) return;
      busy = true;
      controller = new AbortController();
      if (append || notice)
        publish({ ...current, loading: true, error: undefined, notice });
      try {
        const [search, reloads] = await Promise.allSettled([
          source.search({
            query,
            agentId,
            cursor,
            signal: controller.signal,
          }),
          source.reloads?.({ agentId, signal: controller.signal }),
        ]);
        if (!alive) return;
        if (search.status === "rejected") throw search.reason;
        const response = search.value;
        const results = response.results.map(({ trace, matches, ...rest }) => ({
          ...rest,
          trace: {
            ...trace,
            contentCaptured:
              trace.contentAvailability === "not-recorded"
                ? false
                : trace.contentAvailability === "captured"
                  ? true
                  : trace.contentCaptured,
          },
          matches: matches.map((match) => ({ ...match, text: match.excerpt })),
        }));
        setMetadata((previous) => {
          const agents = new Map(
            previous.source === source ? previous.agents : [],
          );
          const known = agents.get(agentId) ?? {
            tools: [],
            agents: [],
          };
          agents.set(agentId, {
            tools: [
              ...new Set([
                ...known.tools,
                ...results.flatMap(({ trace }) => trace.toolNames ?? []),
              ]),
            ],
            agents: [
              ...new Set([
                ...known.agents,
                ...results.flatMap(({ trace }) => [
                  trace.agentId,
                  ...(trace.agentNames ?? []),
                ]),
              ]),
            ],
          });
          return { source, agents };
        });
        publish({
          ...current,
          ...response,
          results: append
            ? [
                ...new Map(
                  [...current.results, ...results].map((result) => [
                    result.trace.traceId,
                    result,
                  ]),
                ).values(),
              ]
            : results,
          reloads:
            reloads.status === "fulfilled"
              ? (reloads.value?.reloads ?? [])
              : [],
          loading: false,
          error: undefined,
          notice,
        });
      } catch (error) {
        if (!alive || error.name === "AbortError") return;
        if (error.status === 409 && append) {
          busy = false;
          await load(
            undefined,
            false,
            "Trace data changed. Results were refreshed.",
          );
          return;
        }
        publish({
          ...current,
          loading: false,
          error: error.message ?? "Could not load traces.",
        });
      } finally {
        busy = false;
      }
    }
    actions.current.loadMore = () =>
      current.nextCursor && load(current.nextCursor, true);

    const timer =
      query && !previous.compatible ? setTimeout(() => load(), 200) : undefined;
    if (timer === undefined) void load();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [source, key, agentId, query, resource, valid, request]);
  const visible =
    valid && compatible
      ? {
          ...state,
          loading: state.request !== request || state.loading,
          error: state.request === request ? state.error : undefined,
        }
      : {
          ...empty,
          loading: valid,
        };
  return {
    ...visible,
    suggestions:
      metadata.source === source ? metadata.agents.get(agentId) : undefined,
    refresh: () => setVersion((value) => value + 1),
    loadMore: () => actions.current.loadMore?.(),
  };
}

export function useTraceDetail(source, agentId, traceId) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({});
  const key = JSON.stringify([agentId, traceId, version]);
  const request = useMemo(
    () => ({ source, agentId, traceId, version }),
    [source, agentId, traceId, version],
  );
  useEffect(() => {
    if (!source || !traceId) return;
    let alive = true;
    const controller = new AbortController();
    source.trace({ agentId, traceId, signal: controller.signal }).then(
      (trace) => {
        if (alive) setState({ key, request, source, trace });
      },
      (error) => {
        if (alive && error.name !== "AbortError")
          setState({
            key,
            request,
            source,
            error:
              error.status === 404
                ? "This trace is no longer available."
                : error.message,
          });
      },
    );
    return () => {
      alive = false;
      controller.abort();
    };
  }, [source, key, agentId, traceId, request]);
  return {
    ...(state.request === request && source && traceId
      ? state
      : { loading: !!source && !!traceId }),
    refresh: () => setVersion((value) => value + 1),
  };
}
