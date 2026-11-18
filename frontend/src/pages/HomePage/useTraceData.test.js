import { test, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTraceData, useTraceDetail } from "./useTraceData";

const page = (id, nextCursor = null) => ({
  results: [
    {
      trace: { traceId: id, agentId: "support" },
      matches: [{ excerpt: "Matched value", field: "output" }],
    },
  ],
  total: 2,
  nextCursor,
  coverage: { complete: true },
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

test("ignores late responses after agent and query changes and cancels old requests", async () => {
  const old = deferred(),
    recent = deferred();
  const source = {
    search: vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(recent.promise),
  };
  const { result, rerender } = renderHook(
    (props) => useTraceData(source, props),
    { initialProps: { agentId: "support", query: "" } },
  );
  await waitFor(() => expect(source.search).toHaveBeenCalledTimes(1));
  const oldSignal = source.search.mock.calls[0][0].signal;
  rerender({ agentId: "research", query: "new" });
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() => expect(source.search).toHaveBeenCalledTimes(2));
  await act(async () => {
    recent.resolve(page("new"));
  });
  expect(result.current.results[0].trace.traceId).toBe("new");
  expect(result.current.results[0].matches[0].text).toBe("Matched value");
  await act(async () => {
    old.resolve(page("old"));
  });
  expect(result.current.results[0].trace.traceId).toBe("new");
});

test("restarts stale pagination without appending obsolete rows", async () => {
  const source = {
    search: vi
      .fn()
      .mockResolvedValueOnce(page("first", "next"))
      .mockRejectedValueOnce(
        Object.assign(new Error("Stale cursor"), { status: 409 }),
      )
      .mockResolvedValueOnce(page("refreshed")),
  };
  const { result } = renderHook(() =>
    useTraceData(source, { agentId: "support", query: "" }),
  );
  await waitFor(() => expect(result.current.nextCursor).toBe("next"));
  await act(async () => {
    await result.current.loadMore();
  });
  expect(result.current.results.map((row) => row.trace.traceId)).toEqual([
    "refreshed",
  ]);
  expect(result.current.notice).toContain("refreshed");
  expect(source.search.mock.calls[1][0].cursor).toBe("next");
  expect(source.search.mock.calls[2][0].cursor).toBeUndefined();
});

test("refresh retains rows while pending and after a failure, then replaces them on success", async () => {
  const refresh = deferred();
  const source = {
    search: vi
      .fn()
      .mockResolvedValueOnce(page("first"))
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(page("newest")),
  };
  const { result } = renderHook(() =>
    useTraceData(source, { agentId: "support", query: "" }),
  );
  await waitFor(() => expect(result.current.results).toHaveLength(1));
  act(() => result.current.refresh());
  expect(result.current.loading).toBe(true);
  expect(result.current.results[0].trace.traceId).toBe("first");
  await waitFor(() => expect(source.search).toHaveBeenCalledTimes(2));
  // A refresh failure keeps useful data available to the mounted explorer.
  await act(async () => refresh.reject(new Error("Offline")));
  expect(result.current.error).toBe("Offline");
  expect(result.current.results[0].trace.traceId).toBe("first");
  act(() => result.current.refresh());
  await waitFor(() =>
    expect(result.current.results[0].trace.traceId).toBe("newest"),
  );
  expect(result.current.error).toBeUndefined();
});

test("retains observed completion metadata across queries without leaking across sources or agents", async () => {
  const first = page("first");
  Object.assign(first.results[0].trace, {
    toolNames: ["read_logs"],
    agentNames: ["Helper"],
  });
  const source = {
    search: vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue({ ...page("unused"), results: [] }),
  };
  const { result, rerender } = renderHook(
    ({ source, ...options }) => useTraceData(source, options),
    {
      initialProps: { source, agentId: "support", query: "" },
    },
  );
  await waitFor(() =>
    expect(result.current.suggestions?.tools).toEqual(["read_logs"]),
  );
  rerender({ source, agentId: "support", query: "tool:" });
  expect(result.current.results).toEqual([]);
  expect(result.current.suggestions.agents).toEqual(["support", "Helper"]);
  expect(source.search).toHaveBeenCalledTimes(1);
  rerender({ source, agentId: "support", query: "missing" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.suggestions.tools).toEqual(["read_logs"]);
  rerender({ source, agentId: "research", query: "tool:" });
  expect(result.current.suggestions).toBeUndefined();
  rerender({ source: { search: vi.fn() }, agentId: "support", query: "tool:" });
  expect(result.current.suggestions).toBeUndefined();
});

test("invalid queries make no request and 404 details remain local to the inspector", async () => {
  const source = {
    search: vi.fn(),
    trace: vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not found"), { status: 404 }),
      ),
  };
  renderHook(() =>
    useTraceData(source, { agentId: "support", query: "tool:" }),
  );
  expect(source.search).not.toHaveBeenCalled();
  const { result } = renderHook(() =>
    useTraceDetail(source, "support", "trace"),
  );
  await waitFor(() =>
    expect(result.current.error).toBe("This trace is no longer available."),
  );
});
