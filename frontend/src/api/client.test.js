import { expect, test, vi } from "vitest";
import { createApiClient, takeLaunchToken } from "./client";

test("consumes the launch credential before rendering and removes it from the URL", () => {
  const browser = {
    location: {
      hash: "#token=secret&view=traces",
      pathname: "/",
      search: "?a=b",
    },
    history: { replaceState: vi.fn() },
  };
  expect(takeLaunchToken(browser)).toBe("secret");
  expect(browser.history.replaceState).toHaveBeenCalledWith(
    null,
    "",
    "/?a=b#view=traces",
  );
});

test("uses same-origin cookie credentials and global search sort direction", async () => {
  const transport = vi.fn(async () => ({
    ok: true,
    json: async () => ({ results: [] }),
  }));
  const client = createApiClient({ fetch: transport });
  await client.search({
    query: 'output:"hello world"',
    agentId: "support",
    sort: { key: "durationMs", direction: "ascending" },
    cursor: "next",
  });
  const [path, options] = transport.mock.calls[0];
  expect(path).not.toContain("secret");
  expect(new URL(path, "http://local").searchParams.get("direction")).toBe(
    "ascending",
  );
  expect(options.headers).toBeUndefined();
  expect(options.credentials).toBe("same-origin");
  expect(options.redirect).toBe("error");
});

test("exchanges the launch token once without putting it in request URLs", async () => {
  const transport = vi.fn(async () => ({
    ok: true,
    json: async () => ({ connected: true }),
  }));
  const client = createApiClient({ fetch: transport });
  await client.connect("launch-secret");
  const [path, options] = transport.mock.calls[0];
  expect(path).toBe("/api/v1/browser-session");
  expect(options.method).toBe("POST");
  expect(options.headers.authorization).toBe("Bearer launch-secret");
  expect(options.credentials).toBe("same-origin");
});

test("preserves request errors without asking users for credentials", async () => {
  const client = createApiClient({
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Even authentication required" }),
    }),
  });
  await expect(client.inventory()).rejects.toMatchObject({ status: 401 });
});
