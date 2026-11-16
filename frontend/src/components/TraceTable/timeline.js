function timestamp(value) {
  return value == null ? NaN : new Date(value).getTime();
}

// Caller owns trace filtering/sorting. Merge observed reloads into chronological
// rows without attributing executions to a code revision or reordering traces.
export function traceTimeline(traces, reloads, sort) {
  const direction = sort.direction === "ascending" ? 1 : -1;
  const seen = new Set();
  const markers =
    sort.key === "startedAt"
      ? reloads
          .filter((item) => {
            if (
              item.type !== "agent.reloaded" ||
              !item.id ||
              seen.has(item.id) ||
              !Number.isFinite(timestamp(item.observedAt))
            )
              return false;
            seen.add(item.id);
            return true;
          })
          .slice()
          .sort(
            (a, b) =>
              direction * (timestamp(a.observedAt) - timestamp(b.observedAt)),
          )
      : [];
  const rows = [];
  let cursor = 0;
  let stripe = 0;
  const nextStripe = () => (stripe++ % 2 === 0 ? "base" : "alternate");
  function appendMarker() {
    rows.push({
      kind: "reload",
      reload: markers[cursor++],
      stripe: nextStripe(),
    });
  }
  for (const trace of traces) {
    const startedAt = timestamp(trace.startedAt);
    while (
      cursor < markers.length &&
      (!Number.isFinite(startedAt) ||
        direction * (timestamp(markers[cursor].observedAt) - startedAt) <= 0)
    )
      appendMarker();
    rows.push({
      kind: "trace",
      trace,
      stripe: nextStripe(),
    });
  }
  while (cursor < markers.length) appendMarker();
  return rows;
}
