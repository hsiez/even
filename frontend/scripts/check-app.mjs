import assert from "node:assert/strict";
import {
  mkdtemp,
  cp,
  mkdir,
  writeFile,
  symlink,
  rm,
  readdir,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { loadEve } from "../../src/eve-adapter.js";
import { startServer } from "../../src/server.js";

if (!process.env.EVEN_TEST_NODE_MODULES)
  throw new Error(
    "Set EVEN_TEST_NODE_MODULES to an Eve 1.0.0-rc.6 installation.",
  );
const project = await mkdtemp(join(tmpdir(), "even-app-browser-"));
let browser, server;
try {
  await cp(new URL("../../test/fixtures/project/", import.meta.url), project, {
    recursive: true,
  });
  await symlink(
    resolve(process.env.EVEN_TEST_NODE_MODULES),
    join(project, "node_modules"),
  );
  await writeFile(
    join(project, "agent/agent.js"),
    'throw new Error("BROWSING MUST NOT EXECUTE AUTHORED CODE"); export default {};',
  );
  for (let n = 1; n <= 52; n++) {
    const traceId = n.toString(16).padStart(32, "0"),
      spanId = n.toString(16).padStart(16, "0");
    const directory = join(project, ".eve/traces/v1", traceId, "segments");
    await mkdir(directory, { recursive: true });
    const attributes = {
      "agent.name": "root",
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": "lookup",
      "gen_ai.tool.call.result": JSON.stringify({
        invoice: n === 1 ? "1234567890123456789" : `recorded-${n}`,
      }),
    };
    await writeFile(
      join(directory, `${spanId}.otlp.json`),
      JSON.stringify({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId,
                    spanId,
                    name: `Recorded lookup ${n}`,
                    startTimeUnixNano: String(BigInt(n) * 1000000000n),
                    endTimeUnixNano: String(BigInt(n) * 2000000000n),
                    attributes: Object.entries(attributes).map(
                      ([key, value]) => ({
                        key,
                        value: { stringValue: value },
                      }),
                    ),
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  }
  server = await startServer(await loadEve(project));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const axe = await readFile(
    new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
    "utf8",
  );
  const urls = [],
    errors = [];
  page.on("request", (request) => urls.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.browserUrl);
  await page.getByRole("heading", { name: "Traces", exact: true }).waitFor();
  await page.getByRole("button", { name: "Load more traces" }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.getByLabel("Launch token").count(), 0);
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) =>
    cookie.name.startsWith("even_browser_"),
  );
  assert.ok(sessionCookie?.httpOnly);
  assert.equal(sessionCookie.sameSite, "Strict");
  assert.equal(sessionCookie.expires, -1);
  await page.reload();
  await page.getByRole("button", { name: "Load more traces" }).waitFor();
  assert.equal(
    await page.getByLabel("Launch token").count(),
    0,
    "Refresh reconnects without user input",
  );
  const another = await page.context().newPage();
  await another.goto(server.url);
  await another.getByRole("heading", { name: "Traces", exact: true }).waitFor();
  await another.close();
  assert.ok(
    urls.every((url) => !url.includes(server.token)),
    "The token never appears in an HTTP request URL",
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
    { local: 0, session: 0 },
  );
  assert.equal(await page.locator(".even-trace-operation-action").count(), 50);
  await page.getByRole("button", { name: "Load more traces" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".even-trace-operation-action").length === 52,
  );
  const search = page.getByRole("combobox", { name: "Search traces" });
  await search.fill("output:1234567890123456789");
  await search.press("Escape");
  const operation = page.getByRole("button", { name: /Recorded lookup 1\b/ });
  await operation.waitFor();
  assert.equal(await page.locator(".even-trace-operation-action").count(), 1);
  await operation.click();
  const inspector = page.getByRole("complementary", {
    name: "Execution inspector",
  });
  await inspector
    .getByRole("treeitem", { name: "Recorded lookup 1" })
    .waitFor();
  assert.ok((await inspector.innerText()).includes("gen_ai.tool.call.result"));
  await page.evaluate(axe);
  assert.deepEqual(
    await page.evaluate(
      async () => (await window.axe.run(document)).violations,
    ),
    [],
  );
  await page.screenshot({ path: "/tmp/even-live-workbench-dark.png" });

  const table = await page
    .getByRole("table", { name: "Recorded traces" })
    .elementHandle();
  const resize = page.getByRole("separator", {
    name: "Resize Operation column",
  });
  await resize.focus();
  await resize.press("Home");
  const width = await resize.getAttribute("aria-valuenow");
  assert.equal(width, "128");
  const selectedSpan = await inspector
    .getByRole("treeitem", { selected: true })
    .getAttribute("data-span-id");
  let releaseSearch, startedSearch;
  const gate = new Promise((resolve) => {
    releaseSearch = resolve;
  });
  const started = new Promise((resolve) => {
    startedSearch = resolve;
  });
  await page.route(
    "**/api/v1/traces/search?**",
    async (route) => {
      startedSearch();
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await started;
  await resize.focus();
  assert.ok(
    await table.evaluate((node) => node.isConnected),
    "Refresh keeps the existing table mounted",
  );
  assert.ok(await inspector.isVisible(), "Refresh keeps the inspector open");
  releaseSearch();
  await page
    .getByText("Loading results…", { exact: true })
    .waitFor({ state: "hidden" });
  assert.ok(
    await table.evaluate((node) => node.isConnected),
    "Successful refresh preserves table identity",
  );
  assert.equal(await resize.getAttribute("aria-valuenow"), width);
  assert.ok(
    await resize.evaluate((node) => node === document.activeElement),
    "Refresh preserves keyboard focus",
  );
  assert.equal(
    await inspector
      .getByRole("treeitem", { selected: true })
      .getAttribute("data-span-id"),
    selectedSpan,
  );

  const addTab = async (name) => {
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
  };
  await addTab("New trace explorer");
  await page.getByRole("button", { name: "Load more traces" }).waitFor();
  assert.equal(await search.inputValue(), "");
  assert.equal(await inspector.count(), 0);
  await page.getByRole("tab", { name: "Traces", exact: true }).click();
  await inspector.waitFor();
  assert.equal(await search.inputValue(), "output:1234567890123456789");
  assert.equal(
    await inspector
      .getByRole("treeitem", { selected: true })
      .getAttribute("data-span-id"),
    selectedSpan,
  );
  await addTab("New chat playground");
  assert.ok(await page.getByLabel("Message", { exact: true }).isDisabled());
  assert.ok(
    urls.every((url) => !url.includes("/api/v1/sessions")),
    "A playground preview does not create or read sessions",
  );
  await page
    .getByRole("button", { name: "Close Playground 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close Traces 2", exact: true })
    .click();
  assert.ok(
    await page
      .getByRole("tab", { name: "Traces", exact: true })
      .evaluate((node) => node === document.activeElement),
  );
  await page.getByRole("button", { name: "Close inspector" }).click();
  await search.fill("tool:");
  await page.getByRole("option", { name: /tool:lookup/ }).waitFor();
  await search.fill("agent:");
  await page.getByRole("option", { name: /agent:root/ }).waitFor();
  await search.fill("");
  await search.press("Escape");
  assert.equal(
    await page.getByRole("button", { name: "Duration", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Started", exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("columnheader", { name: "Started" })
      .getAttribute("aria-sort"),
    "descending",
  );
  await page.waitForFunction(() =>
    /^Recorded lookup 52\b/.test(
      document.querySelector(".even-trace-operation-action")?.textContent ?? "",
    ),
  );
  await page.getByRole("radio", { name: "Light theme", exact: true }).click();
  await page.screenshot({ path: "/tmp/even-live-workbench-light.png" });
  const write = await page.evaluate(async () => {
    const response = await fetch("/api/v1/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    });
    return response.status;
  });
  assert.equal(
    write,
    400,
    "A browser same-origin POST reaches route validation",
  );
  assert.deepEqual(
    await page.evaluate(
      async () => (await window.axe.run(document)).violations,
    ),
    [],
  );
  assert.deepEqual(await readdir(join(project, ".eve")), ["traces"]);
  // A subsequent CLI startup automatically opens its new handoff URL. Simulate
  // that new tab in the same browser profile and verify existing tabs recover.
  const port = Number(new URL(server.url).port);
  await server.close();
  server = await startServer(await loadEve(project), { port });
  const reopened = await page.context().newPage();
  await reopened.goto(server.browserUrl);
  await reopened
    .getByRole("heading", { name: "Traces", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Load more traces" }).waitFor();
  await reopened.close();
  assert.deepEqual(errors, []);
  console.log(
    "Verified automatic browser connection, refresh preserving inspector/widths/focus, retained autocomplete, additional tabs, new-launch handoff, real Eve search, pagination, newest-first ordering, inspection, cookie-authenticated writes, and passive execution boundaries.",
  );
} finally {
  await browser?.close();
  await server?.close();
  await rm(project, { recursive: true, force: true });
}
