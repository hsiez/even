import { useEffect, useRef, useState } from "react";
import { parseTraceQuery } from "../../search/traceSearch";

const empty = {
  results: [],
  total: 0,
  nextCursor: null,
  reloads: [],
  loading: false,
};

export function useTraceData(source, { agentId, query, sort }) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(empty);
  const actions = useRef({});
  const key = JSON.stringify([
    agentId,
    query,
    sort.key,
    sort.direction,
    version,
  ]);
  useEffect(() => {
    actions.current = {};
    if (!source || !agentId || parseTraceQuery(query).error) {
      setState({ ...empty, key });
      return;
    }
    let alive = true,
      busy = false,
      controller;
    let current = { ...empty, key, loading: true };
    const publish = (next) => {
      current = next;
      if (alive) setState(next);
    };
    async function load(cursor, append = false, notice) {
      if (!alive || busy) return;
      busy = true;
      controller = new AbortController();
      publish({ ...current, loading: true, error: undefined, notice });
      try {
        const [search, reloads] = await Promise.allSettled([
          source.search({
            query,
            agentId,
            sort,
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
    publish(current);
    actions.current.loadMore = () =>
      current.nextCursor && load(current.nextCursor, true);
    // Debounce text entry; agent and sort changes use the same cancellable path.
    const timer = setTimeout(() => load(), query ? 200 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [source, key]);
  const visible =
    state.key === key
      ? state
      : {
          ...empty,
          loading: !!source && !!agentId && !parseTraceQuery(query).error,
        };
  return {
    ...visible,
    refresh: () => setVersion((value) => value + 1),
    loadMore: () => actions.current.loadMore?.(),
  };
}

export function useTraceDetail(source, agentId, traceId) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({});
  const key = JSON.stringify([agentId, traceId, version]);
  useEffect(() => {
    if (!source || !traceId) {
      setState({ key });
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setState({ key, loading: true });
    source.trace({ agentId, traceId, signal: controller.signal }).then(
      (trace) => {
        if (alive) setState({ key, trace });
      },
      (error) => {
        if (alive && error.name !== "AbortError")
          setState({
            key,
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
  }, [source, key]);
  return {
    ...(state.key === key ? state : { loading: !!source && !!traceId }),
    refresh: () => setVersion((value) => value + 1),
  };
}
