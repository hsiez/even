import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import Color from "colorjs.io";
import {
  contrastPairs,
  resolveColor,
  semanticVariable,
  themes,
} from "../src/tokens/colors.js";

const directory = fileURLToPath(
  new URL("../storybook-static/", import.meta.url),
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer(async (request, response) => {
  try {
    let path = resolve(
      directory,
      "." +
        decodeURIComponent(new URL(request.url, "http://localhost").pathname),
    );
    if (path !== directory.slice(0, -1) && !path.startsWith(directory))
      throw new Error("Outside build");
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    response.setHeader(
      "content-type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  const index = JSON.parse(
    await readFile(resolve(directory, "index.json"), "utf8"),
  );
  const stories = Object.values(index.entries).filter(
    (entry) => entry.type === "story",
  );
  const axe = await readFile(
    fileURLToPath(import.meta.resolve("axe-core/axe.min.js")),
    "utf8",
  );
  for (const theme of themes) {
    for (const story of stories) {
      const errors = [];
      const onError = (error) => errors.push(error.message);
      page.on("pageerror", onError);
      console.log(`Checking ${theme}: ${story.id}`);
      await page.goto(
        `${base}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
      );
      await page.waitForFunction(
        () => document.querySelector("#storybook-root")?.childNodes.length > 0,
      );
      assert.equal(
        await page.locator(".sb-errordisplay").isVisible(),
        false,
        story.id,
      );
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(
        async (auditColor) =>
          (
            await window.axe.run(document.body, {
              rules: {
                "color-contrast": { enabled: auditColor },
                region: { enabled: false },
              },
            })
          ).violations.map((item) => ({
            id: item.id,
            elements: item.nodes.map((node) => node.html),
          })),
        true,
      );
      assert.deepEqual(errors, [], `${story.id}: runtime errors`);
      assert.deepEqual(violations, [], `${story.id}: accessibility`);
      page.off("pageerror", onError);
    }
  }
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchlayout--composed-explorer&viewMode=story`,
  );
  await page.getByRole("button", { name: "Investigate deployment" }).click();
  const inspector = page.getByRole("complementary", {
    name: "Execution inspector",
  });
  await inspector
    .getByRole("treeitem", { name: "Read deployment logs" })
    .click();
  await inspector
    .getByRole("region", { name: "Span details" })
    .getByText("Permission denied", { exact: true })
    .waitFor();
  await page.addScriptTag({ content: axe });
  const openInspectorViolations = await page.evaluate(async () =>
    (
      await window.axe.run(document.body, {
        rules: {
          "color-contrast": { enabled: true },
          region: { enabled: false },
        },
      })
    ).violations.map((item) => item.id),
  );
  assert.deepEqual(
    openInspectorViolations,
    [],
    "Composed open inspector accessibility",
  );
  await inspector.getByRole("button", { name: "Close inspector" }).click();
  assert.equal(await inspector.count(), 0);
  await page.getByRole("tab", { name: "Traces", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Playground" })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("button", { name: "New session" }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Inspect deployment");
  await page.getByRole("button", { name: "Send message" }).click();
  assert.match(await page.getByRole("log").innerText(), /Inspect deployment/);
  // Check portal-based interactions in a real browser, beyond static story audits.
  await page.goto(
    `${base}/iframe.html?id=primitives-dialog--default&viewMode=story`,
  );
  const dialogTrigger = page.getByRole("button", { name: "Open settings" });
  await dialogTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Agent settings" });
  await dialog.waitFor();
  const close = dialog.getByRole("button", { name: "Close settings" });
  await close.focus();
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    (input) => input === document.activeElement,
    await dialog.getByRole("textbox", { name: "Agent name" }).elementHandle(),
  );
  assert.equal(
    await dialog
      .getByRole("textbox", { name: "Agent name" })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Close settings",
  );
  assert.equal(
    await close.evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Open settings",
  );

  await page.goto(
    `${base}/iframe.html?id=primitives-menu--default&viewMode=story`,
  );
  await page.getByRole("button", { name: "Trace actions" }).focus();
  await page.keyboard.press("ArrowDown");
  const copyItem = page.getByRole("menuitem", { name: "Copy trace ID" });
  await copyItem.waitFor();
  await page.waitForFunction(
    (item) => item === document.activeElement,
    await copyItem.elementHandle(),
  );
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor({ state: "hidden" });
  await page.getByRole("status").filter({ hasText: "copied" }).waitFor();
  assert.match(await page.getByRole("status").innerText(), /copied/);

  await page.goto(
    `${base}/iframe.html?id=primitives-popover--default&viewMode=story`,
  );
  await page.getByRole("button", { name: "Filter options" }).click();
  await page.getByRole("dialog", { name: "Filter traces" }).waitFor();
  await page.getByRole("checkbox", { name: "Errors only" }).check();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await page.goto(
    `${base}/iframe.html?id=primitives-tooltip--default&viewMode=story`,
  );
  await page.getByRole("button", { name: "Refresh traces" }).focus();
  const hint = page
    .locator("[data-base-ui-portal]")
    .getByText("Refresh traces", { exact: true });
  await hint.waitFor();
  await page.keyboard.press("Escape");
  await hint.waitFor({ state: "hidden" });
  // Exercise decisions on actual consumers, portal inheritance and responsive layout.
  for (const theme of themes) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${base}/iframe.html?id=primitives-button--variants-and-sizes&viewMode=story&globals=theme:${theme}`,
    );
    const primary = page.getByRole("button", {
      name: "primary compact",
      exact: true,
    });
    await primary.waitFor();
    assert.equal(
      await primary.evaluate((node) => getComputedStyle(node).minHeight),
      "32px",
    );
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--even-size-control-compact",
        "3rem",
      ),
    );
    assert.equal(
      await primary.evaluate((node) => getComputedStyle(node).minHeight),
      "48px",
      "Control consumes the size decision",
    );
    await page.evaluate(() =>
      document.documentElement.style.removeProperty(
        "--even-size-control-compact",
      ),
    );
    await primary.focus();
    assert.equal(
      await primary.evaluate((node) => getComputedStyle(node).outlineStyle),
      "solid",
    );
    // Unlayered consumer CSS wins over the library's default presentation.
    await page.addStyleTag({
      content: ".consumer-override { min-height: 3.5rem; }",
    });
    await primary.evaluate((node) => node.classList.add("consumer-override"));
    assert.equal(
      await primary.evaluate((node) => getComputedStyle(node).minHeight),
      "56px",
    );
    await primary.evaluate((node) => {
      node.style.minHeight = "4rem";
    });
    assert.equal(
      await primary.evaluate((node) => getComputedStyle(node).minHeight),
      "64px",
    );

    await page.goto(
      `${base}/iframe.html?id=primitives-dialog--initially-open&viewMode=story&globals=theme:${theme}`,
    );
    const popup = page.getByRole("dialog", { name: "Agent settings" });
    await popup.waitFor();
    const popupColor = await popup.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    assert.ok(
      new Color(popupColor).deltaE(
        new Color(resolveColor(theme, "surface.page")),
        "OK",
      ) < 0.01,
      "Portal inherits the active theme",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await popup.boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.x + bounds.width <= 390,
      "Modal fits narrow viewport",
    );
    await page.goto(
      `${base}/iframe.html?id=workbench-workbenchlayout--composed-explorer&viewMode=story&globals=theme:${theme}`,
    );
    await page.getByRole("button", { name: "Investigate deployment" }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      "Workbench contains overflow at narrow widths",
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // Verify real CSS resolution in both gamuts, including nested theme boundaries.
  const session = await page.context().newCDPSession(page);
  for (const gamut of ["srgb", "p3"]) {
    await session.send("Emulation.setEmulatedMedia", {
      features: [{ name: "color-gamut", value: gamut }],
    });
    await page.goto(
      `${base}/iframe.html?id=foundations-colors--both-themes&viewMode=story`,
    );
    await page
      .getByRole("region", { name: "dark color tokens", exact: true })
      .waitFor();
    // Storybook deliberately themes html for portals. Removing that opt-in
    // must still leave an unthemed document without token values.
    assert.equal(
      await page.evaluate(() => {
        const root = document.documentElement;
        const theme = root.dataset.evenTheme;
        delete root.dataset.evenTheme;
        const value = getComputedStyle(document.body).getPropertyValue(
          "--even-text-primary",
        );
        root.dataset.evenTheme = theme;
        return value;
      }),
      "",
      "Tokens must not leak to an unthemed document",
    );
    for (const theme of themes) {
      const actual = await page
        .locator(`section[data-even-theme="${theme}"]`)
        .evaluate(
          (scope, pairs) =>
            pairs.map((pair) => {
              const sample = document.createElement("span");
              sample.style.color = `var(${pair.foregroundVariable})`;
              sample.style.backgroundColor = `var(${pair.backgroundVariable})`;
              scope.append(sample);
              const style = getComputedStyle(sample);
              const result = {
                foreground: style.color,
                background: style.backgroundColor,
              };
              sample.remove();
              return result;
            }),
          contrastPairs.map((pair) => ({
            foregroundVariable: semanticVariable(pair.foreground),
            backgroundVariable: semanticVariable(pair.background),
          })),
        );
      for (const [index, pair] of contrastPairs.entries()) {
        const foreground = new Color(actual[index].foreground);
        const background = new Color(actual[index].background);
        const expected = new Color(resolveColor(theme, pair.foreground, gamut));
        assert.ok(
          foreground.deltaE(expected, "OK") < 0.01,
          `${theme} ${gamut}: ${pair.foreground} resolved incorrectly`,
        );
        assert.ok(
          Color.contrastWCAG21(foreground, background) >= pair.minimum,
          `${theme} ${gamut}: ${pair.foreground} on ${pair.background}`,
        );
      }
    }
  }
  // rem decisions respond to root text sizing; no app CSS fixes the root size.
  const dimensionMeasurements = await page.evaluate(() => {
    const previous = document.documentElement.style.fontSize;
    const scope = document.createElement("div");
    scope.dataset.evenTheme = "light";
    const sample = document.createElement("div");
    sample.style.width = "var(--even-space-gap-related)";
    sample.style.minHeight = "var(--even-size-control-default)";
    scope.append(sample);
    document.body.append(scope);
    try {
      document.documentElement.style.fontSize = "16px";
      const normal = {
        width: getComputedStyle(sample).width,
        height: getComputedStyle(sample).minHeight,
      };
      document.documentElement.style.fontSize = "20px";
      const enlarged = {
        width: getComputedStyle(sample).width,
        height: getComputedStyle(sample).minHeight,
      };
      return { normal, enlarged };
    } finally {
      scope.remove();
      document.documentElement.style.fontSize = previous;
    }
  });
  assert.deepEqual(dimensionMeasurements, {
    normal: { width: "8px", height: "40px" },
    enlarged: { width: "10px", height: "50px" },
  });
  // A nested light scope inside dark must rebind aliases instead of inheriting resolved dark values.
  const nested = await page.evaluate(() => {
    const outer = document.createElement("div");
    outer.dataset.evenTheme = "dark";
    const inner = document.createElement("div");
    inner.dataset.evenTheme = "light";
    inner.style.color = "var(--even-text-primary)";
    outer.append(inner);
    document.body.append(outer);
    const result = getComputedStyle(inner).color;
    outer.remove();
    return result;
  });
  assert.ok(
    new Color(nested).deltaE(
      new Color(resolveColor("light", "text.primary", "p3")),
      "OK",
    ) < 0.01,
  );
  if (process.env.EVEN_COLOR_SCREENSHOT) {
    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.goto(
      `${base}/iframe.html?id=foundations-colors--dark&viewMode=story`,
    );
    await page
      .getByRole("region", { name: "dark color tokens", exact: true })
      .waitFor();
    await page.screenshot({ path: process.env.EVEN_COLOR_SCREENSHOT });
  }
  console.log(
    "Verified color CSS scope, nested themes, and semantic contrast in sRGB and P3.",
  );
  console.log(
    `Verified ${stories.length} rendered stories in both themes, accessibility audits, and explorer/playground plus overlay interactions in Chromium.`,
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
