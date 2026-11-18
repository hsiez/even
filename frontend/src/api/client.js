export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The launch fragment is never sent over HTTP. Consume it before rendering and
// remove it from the address bar/history before the automatic session exchange.
export function takeLaunchToken(browser = window) {
  const hash = new URLSearchParams(browser.location.hash.slice(1));
  const token = hash.get("token") ?? "";
  if (hash.has("token")) {
    hash.delete("token");
    browser.history.replaceState(
      null,
      "",
      browser.location.pathname +
        browser.location.search +
        (hash.size ? `#${hash}` : ""),
    );
  }
  return token;
}

export function createApiClient({ fetch: transport = globalThis.fetch } = {}) {
  async function request(path, { signal, method = "GET", headers } = {}) {
    const response = await transport(`/api/v1${path}`, {
      method,
      headers,
      credentials: "same-origin",
      redirect: "error",
      signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(response.status, data.error ?? "The request failed.");
    }
    return data;
  }
  return {
    connect: (token) =>
      request("/browser-session", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
    inventory: (options) => request("/agents", options),
    search({ query, agentId, sort, cursor, signal }) {
      const params = new URLSearchParams({
        q: query,
        agentId,
        sort: sort.key === "startedAt" ? "latest" : "duration",
        direction: sort.direction,
      });
      if (cursor) params.set("cursor", cursor);
      return request(`/traces/search?${params}`, { signal });
    },
    trace: ({ agentId, traceId, signal }) =>
      request(
        `/agents/${encodeURIComponent(agentId)}/traces/${encodeURIComponent(traceId)}`,
        { signal },
      ),
    reloads: ({ agentId, signal }) =>
      request(`/agents/${encodeURIComponent(agentId)}/reloads`, { signal }),
  };
}
