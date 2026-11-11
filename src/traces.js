// Eve owns segment parsing, incremental reads, and the cached assembled traces.
export function createTraceReader(internal) {
  const stores = new Map();
  const pending = new Map();
  // TODO: Bound retained trace memory when Eve exposes cache eviction, or add
  // a deliberate store-lifetime policy. Do not duplicate Eve's span cache.
  const helpers = () => Promise.all([
    internal('cli/dev/tui/traces/trace-store.js'),
    internal('tracing/local/trace-summary.js'),
    internal('tracing/local/trace-query.js'),
  ]);
  return async (appRoot, requestedId, sessionId) => {
    // Eve's direct read accepts a path component; keep API IDs constrained.
    if (requestedId !== undefined && !/^[a-f0-9]{32}$/.test(requestedId)) return undefined;
    const [{ createTraceStore }, { summarizeLocalTrace }, { queryLocalTraceSummaries }] = await helpers();
    let store = stores.get(appRoot);
    if (!store) {
      store = createTraceStore({ appRoot });
      stores.set(appRoot, store);
    }
    // Eve marks segments seen before their asynchronous reads finish. Keep
    // complete inspection operations exclusive within each agent store.
    const operation = (pending.get(appRoot) ?? Promise.resolve()).then(async () => {
      if (requestedId !== undefined) return store.read(requestedId);
      const traces = [];
      for (const { traceId } of await store.list()) {
        const trace = await store.read(traceId);
        if (trace) traces.push(trace);
      }
      if (sessionId === undefined) return traces;
      const summaries = traces.map(trace => summarizeLocalTrace(trace.traceId, trace.spans));
      const { matches } = queryLocalTraceSummaries(summaries, {
        sessionId, limit: summaries.length, sortBy: 'latest',
      });
      const byId = new Map(traces.map(trace => [trace.traceId, trace]));
      return matches.map(summary => byId.get(summary.traceId));
    });
    const settled = operation.then(() => {}, () => {});
    pending.set(appRoot, settled);
    try {
      return await operation;
    } finally {
      if (pending.get(appRoot) === settled) pending.delete(appRoot);
    }
  };
}
