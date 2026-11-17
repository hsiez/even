import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import Color from "colorjs.io";
import { checkDecisionUsage } from "./check-decision-usage.mjs";
import { checkHomePage } from "./check-home-page.mjs";
import {
  contrastPairs,
  scaleNames,
  componentScales,
  paletteVariable,
  onFillVariable,
  resolveOnFill,
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
  ".woff2": "font/woff2",
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
      await page.evaluate(() => document.fonts.ready);
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
  for (const theme of themes) await checkHomePage(page, base, theme, axe);
  await page.setViewportSize({ width: 1280, height: 720 });
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

  // Mixed keyboard/pointer selection must leave exactly one tree tab stop.
  await page.goto(
    `${base}/iframe.html?id=workbench-spanwaterfall--default&viewMode=story`,
  );
  await page
    .getByRole("treeitem", { name: "Agent activation", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.getByRole("button", { name: "Model call", exact: true }).click();
  assert.deepEqual(
    await page
      .getByRole("treeitem")
      .evaluateAll((items) =>
        items
          .filter((item) => item.tabIndex === 0)
          .map((item) => item.dataset.spanId),
      ),
    ["tool"],
    "Tree remembers arrow focus independently of timeline selection",
  );

  for (const theme of themes) {
    await page.setViewportSize({ width: 1000, height: 750 });
    await page.goto(
      `${base}/iframe.html?id=primitives-dialog--nested-overlays&viewMode=story&globals=theme:${theme}`,
    );
    await page
      .getByRole("button", { name: "Open outer popover", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open nested dialog", exact: true })
      .click();
    const nestedDialog = page.getByRole("dialog", {
      name: "Nested dialog",
      exact: true,
    });
    await nestedDialog.waitFor();
    const parentPopup = page
      .locator(".even-popover-popup")
      .filter({ has: page.getByText("Outer popover", { exact: true }) });
    const overlap = await nestedDialog.evaluate(
      (modal, parent) => {
        const a = modal.getBoundingClientRect(),
          b = parent.getBoundingClientRect();
        const left = Math.max(a.left, b.left),
          right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top),
          bottom = Math.min(a.bottom, b.bottom);
        return {
          intersects: right > left && bottom > top,
          modalAbove: modal.contains(
            document.elementFromPoint((left + right) / 2, (top + bottom) / 2),
          ),
        };
      },
      await parentPopup.elementHandle(),
    );
    assert.equal(
      overlap.intersects,
      true,
      "Regression fixture actually overlaps the parent popup and modal",
    );
    assert.equal(
      overlap.modalAbove,
      true,
      "Nested dialog paints above its parent popover",
    );

    await nestedDialog.getByRole("combobox", { name: "Trace outcome" }).click();
    const errorsOption = page.getByRole("option", {
      name: "Errors only",
      exact: true,
    });
    await errorsOption.waitFor();
    await page.waitForFunction(
      (node) => {
        const r = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      },
      await errorsOption.elementHandle(),
    );
    assert.equal(
      await errorsOption.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
      true,
      "Select popup paints above its parent dialog",
    );
    await errorsOption.click();
    await page
      .getByRole("option", { name: "Errors only", exact: true })
      .waitFor({ state: "hidden" });
    await nestedDialog
      .getByRole("button", { name: "Open dialog popover", exact: true })
      .click();
    const childPopup = page.getByRole("dialog", {
      name: "Dialog popover",
      exact: true,
    });
    await childPopup.waitFor();
    // Positioning/focus settle after the popup first becomes visible.
    await page.waitForFunction(
      (node) => {
        const r = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      },
      await childPopup.elementHandle(),
    );
    assert.equal(
      await childPopup.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
      true,
      "Child popover paints above the modal",
    );
    await page.addScriptTag({ content: axe });
    const nestedViolations = await page.evaluate(async () =>
      (
        await window.axe.run(document.body, {
          rules: { region: { enabled: false } },
        })
      ).violations.map((item) => item.id),
    );
    assert.deepEqual(nestedViolations, [], "Nested overlay accessibility");
    await childPopup
      .getByRole("button", { name: "Close dialog popover", exact: true })
      .click();
    await nestedDialog
      .getByRole("button", { name: "Close nested dialog", exact: true })
      .click();
    await nestedDialog.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Open nested dialog", exact: true })
      .waitFor();

    await page.goto(
      `${base}/iframe.html?id=workbench-conversation--late-execution-links&viewMode=story&globals=theme:${theme}`,
    );
    const log = page.getByRole("log");
    await log.waitFor();
    await page
      .getByRole("button", { name: "Resolve execution links", exact: true })
      .click();
    await page
      .getByRole("link", { name: "View execution 3", exact: true })
      .waitFor();
    await page.waitForFunction(
      (node) => node.scrollHeight - node.scrollTop - node.clientHeight < 1,
      await log.elementHandle(),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Follow latest activity" })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Reset execution links", exact: true })
      .click();
    await log.hover();
    await page.mouse.wheel(0, -5000);
    await page.waitForFunction(
      (node) => node.scrollTop < 1,
      await log.elementHandle(),
    );
    await page
      .getByRole("button", { name: "Resolve execution links", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Follow latest activity" })
      .waitFor();
    assert.equal(
      await log.evaluate((node) => node.scrollTop),
      0,
      "Late trace links preserve the reader's position",
    );
    await page.getByRole("button", { name: "Follow latest activity" }).click();
    await page.waitForFunction(
      (node) => node.scrollHeight - node.scrollTop - node.clientHeight < 1,
      await log.elementHandle(),
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // Exercise decisions on actual consumers, portal inheritance and responsive layout.
  for (const theme of themes) {
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--reload-timeline&viewMode=story&globals=theme:${theme}`,
    );
    await page.getByText("Agent reloaded", { exact: true }).waitFor();
    await page.waitForFunction(
      (value) => document.documentElement.dataset.evenTheme === value,
      theme,
    );
    await page.mouse.move(0, 0);
    const traceRows = page.locator(
      '.even-trace-table tr[data-row-kind="trace"]',
    );
    // Measure rendered text, including text inside sortable headers and badges.
    // Checking cell boxes alone misses nested control-padding regressions.
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 720 });
      const offsets = await page
        .locator(".even-trace-table")
        .evaluate((table) => {
          function textBounds(element) {
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
            );
            const rectangles = [];
            let node;
            while ((node = walker.nextNode())) {
              if (!node.textContent.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              rectangles.push(range.getBoundingClientRect());
            }
            const top = Math.min(...rectangles.map((rect) => rect.top));
            const bottom = Math.max(...rectangles.map((rect) => rect.bottom));
            return {
              left: Math.min(...rectangles.map((rect) => rect.left)),
              top,
              height: bottom - top,
            };
          }
          const headers = [...table.querySelectorAll("thead th")];
          return [...table.querySelectorAll('[data-row-kind="trace"]')].flatMap(
            (row) =>
              headers.map((header, index) => ({
                column: header.textContent,
                delta:
                  textBounds(row.cells[index]).left - textBounds(header).left,
                verticalDelta:
                  textBounds(row.cells[index]).top +
                  textBounds(row.cells[index]).height / 2 -
                  (textBounds(row.cells[3]).top +
                    textBounds(row.cells[3]).height / 2),
              })),
          );
        });
      for (const offset of offsets) {
        assert.ok(
          Math.abs(offset.delta) < 0.5,
          `${theme}, ${width}px: ${offset.column} text aligns with its header (offset ${offset.delta}px)`,
        );
        assert.ok(
          Math.abs(offset.verticalDelta) <= 1,
          `${theme}, ${width}px: ${offset.column} text is vertically centered with the Operation label (offset ${offset.verticalDelta}px)`,
        );
      }
      const coverage = await traceRows.evaluateAll((rows) =>
        rows.map((row) => {
          const cell = row.cells[3].getBoundingClientRect();
          const button = row.cells[3]
            .querySelector("button")
            .getBoundingClientRect();
          return Math.max(
            Math.abs(cell.left - button.left),
            Math.abs(cell.top - button.top),
            Math.abs(cell.right - button.right),
            Math.abs(cell.bottom - button.bottom),
          );
        }),
      );
      for (const gap of coverage)
        assert.ok(
          gap <= 0.75,
          `${theme}, ${width}px: Operation target fills its cell (largest gap ${gap}px)`,
        );
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("button", { name: "Started", exact: true }).focus();
    assert.equal(
      await page
        .getByRole("button", { name: "Started", exact: true })
        .evaluate((node) => getComputedStyle(node).outlineStyle),
      "solid",
      "Table header actions retain keyboard focus indicators",
    );
    const backgrounds = await page
      .locator(".even-trace-table tbody tr")
      .evaluateAll((rows) =>
        rows.map((row) => getComputedStyle(row).backgroundColor),
      );
    assert.equal(backgrounds.length, 5);
    for (const [index, background] of backgrounds.entries()) {
      const expected = resolveColor(
        theme,
        index % 2 === 0 ? "surface.page" : "surface.secondary",
      );
      assert.ok(
        new Color(background).deltaE(new Color(expected), "OK") < 0.01,
        "Reload markers participate in the continuous zebra pattern",
      );
    }
    assert.equal(
      await page.locator(".even-trace-reload td").getAttribute("colspan"),
      "6",
    );
    const operationCell = traceRows.first().locator("td").nth(3);
    const cellBounds = await operationCell.boundingBox();
    await operationCell.click({
      position: { x: cellBounds.width - 2, y: cellBounds.height - 2 },
    });
    assert.equal(
      await page
        .getByRole("button", { name: "Investigate deployment", exact: true })
        .getAttribute("aria-pressed"),
      "true",
      "Clicking the empty cell edge selects the trace",
    );
    const selection = await traceRows
      .first()
      .evaluate((row) => getComputedStyle(row).backgroundColor);
    assert.ok(
      new Color(selection).deltaE(
        new Color(resolveColor(theme, "selection.background")),
        "OK",
      ) < 0.01,
      "Selection overrides zebra backgrounds",
    );
    await page.keyboard.press("Tab");
    const keyboardOperation = page.getByRole("button", {
      name: "Read deployment status",
      exact: true,
    });
    await keyboardOperation.focus();
    const focusStyle = await keyboardOperation.evaluate((node) => ({
      outline: getComputedStyle(node).outlineStyle,
      offset: getComputedStyle(node).outlineOffset,
    }));
    assert.deepEqual(
      focusStyle,
      { outline: "solid", offset: "-2px" },
      "Full-cell keyboard focus remains visible inside the cell",
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await keyboardOperation.getAttribute("aria-pressed"),
      "true",
      "Operation cells retain native keyboard activation",
    );
    await page.getByRole("button", { name: "Started", exact: true }).click();
    assert.match(await traceRows.first().innerText(), /Inspect permissions/);
    await page.getByRole("button", { name: "Duration", exact: true }).click();
    assert.equal(
      await page.getByText("Agent reloaded", { exact: true }).count(),
      0,
      "Duration sorting omits chronological reload markers",
    );

    // Resize controls change native column geometry, including every body row.
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--reload-timeline&viewMode=story&globals=theme:${theme}`,
    );
    const table = page.locator(".even-trace-table");
    const operationHandle = page.getByRole("separator", {
      name: "Resize Operation column",
      exact: true,
    });
    await operationHandle.waitFor();
    assert.equal(await page.getByRole("separator").count(), 5);
    assert.equal(
      await page
        .getByRole("separator", { name: "Resize Outcome column" })
        .count(),
      0,
    );
    await page.evaluate(async () => {
      await document.fonts.load('500 14px "Geist Mono Variable"');
      await document.fonts.ready;
    });
    const dataFont = await table.evaluate((node) => {
      const operation = node.querySelector(".even-trace-operation-action");
      const agent = node.querySelector('td[data-column-id="agent"]');
      const duration = node.querySelector(
        '[data-row-kind="trace"] td:nth-child(2)',
      );
      const probe = document.createElement("span");
      // The font shorthand may be empty when tabular numerals are enabled.
      const durationStyle = getComputedStyle(duration);
      for (const property of [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "fontVariantNumeric",
      ])
        probe.style[property] = durationStyle[property];
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.textContent = "Wi";
      document.body.append(probe);
      const range = document.createRange();
      range.setStart(probe.firstChild, 0);
      range.setEnd(probe.firstChild, 1);
      const wide = range.getBoundingClientRect().width;
      range.setStart(probe.firstChild, 1);
      range.setEnd(probe.firstChild, 2);
      const narrow = range.getBoundingClientRect().width;
      probe.remove();
      return {
        family: getComputedStyle(node).fontFamily,
        durationFamily: getComputedStyle(duration).fontFamily,
        operationFamily: getComputedStyle(operation).fontFamily,
        agentFamily: getComputedStyle(agent).fontFamily,
        operationHeaderFamily: getComputedStyle(
          node.querySelector('th[data-column-id="operation"]'),
        ).fontFamily,
        agentHeaderFamily: getComputedStyle(
          node.querySelector('th[data-column-id="agent"]'),
        ).fontFamily,
        loaded: [...document.fonts].some(
          (face) =>
            face.family.includes("Geist Mono Variable") &&
            face.status === "loaded",
        ),
        wide,
        narrow,
      };
    });
    assert.equal(
      dataFont.loaded,
      true,
      "The bundled Geist Mono asset actually loads",
    );
    assert.ok(dataFont.family.includes("Geist Mono Variable"));
    assert.ok(dataFont.durationFamily.includes("Geist Mono Variable"));
    for (const family of [
      dataFont.operationFamily,
      dataFont.agentFamily,
      dataFont.operationHeaderFamily,
      dataFont.agentHeaderFamily,
    ]) {
      assert.ok(
        family.includes("system-ui") && !family.includes("Geist Mono"),
        "Agent and Operation use the UI font, including headers and the cell button",
      );
    }
    assert.ok(
      Math.abs(dataFont.wide - dataFont.narrow) < 0.1 && dataFont.wide > 0,
      "Wide and narrow Latin characters have equal advances in the loaded table font",
    );
    const resizeEdge = () =>
      operationHandle.evaluate(
        (node) => getComputedStyle(node, "::after").opacity,
      );
    await page.mouse.move(0, 0);
    assert.equal(
      await resizeEdge(),
      "0",
      "Resize dividers stay quiet outside the header",
    );
    await table.locator("thead tr").hover({ position: { x: 4, y: 4 } });
    assert.deepEqual(
      await table
        .locator(".even-column-resizer")
        .evaluateAll((nodes) =>
          nodes.map((node) => getComputedStyle(node, "::after").opacity),
        ),
      ["1", "1", "1", "1", "1"],
      "Hovering the header reveals every resize divider",
    );
    await page.mouse.move(0, 0);
    assert.equal(
      await resizeEdge(),
      "0",
      "Leaving the header hides the dividers again",
    );
    await operationHandle.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    assert.equal(
      await resizeEdge(),
      "1",
      "Keyboard focus reveals a resize handle without hover",
    );
    await page.mouse.click(0, 0);
    const initialGeometry = await table.evaluate((node) => ({
      widths: [...node.querySelectorAll("thead th")].map(
        (header) => header.getBoundingClientRect().width,
      ),
      rowHeight: Math.max(
        ...[...node.querySelectorAll('[data-row-kind="trace"]')].map(
          (row) => row.getBoundingClientRect().height,
        ),
      ),
    }));
    let grip = await operationHandle.boundingBox();
    await page.mouse.move(grip.x + grip.width - 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width + 78, grip.y + grip.height + 60, {
      steps: 5,
    });
    assert.equal(
      await resizeEdge(),
      "1",
      "An active drag stays visible outside the header",
    );
    await page.mouse.up();
    const resized = await table.evaluate((node) => ({
      widths: [...node.querySelectorAll("thead th")].map(
        (header) => header.getBoundingClientRect().width,
      ),
      cells: [...node.querySelectorAll('[data-row-kind="trace"]')].map(
        (row) => row.cells[3].getBoundingClientRect().width,
      ),
    }));
    assert.ok(
      Math.abs(resized.widths[3] - initialGeometry.widths[3] - 80) < 1,
      "Captured pointer drag works outside the header",
    );
    for (const index of [0, 1, 2, 4])
      assert.ok(
        Math.abs(resized.widths[index] - initialGeometry.widths[index]) < 1,
        "Resizing preserves other adjustable widths",
      );
    for (const width of resized.cells)
      assert.ok(
        Math.abs(width - resized.widths[3]) < 1,
        "Every row follows its native column width",
      );
    await operationHandle.focus();
    await page.keyboard.press("Home");
    const minimum = Number(await operationHandle.getAttribute("aria-valuemin"));
    assert.equal(
      Number(await operationHandle.getAttribute("aria-valuenow")),
      minimum,
    );
    await page.keyboard.press("ArrowLeft");
    assert.equal(
      Number(await operationHandle.getAttribute("aria-valuenow")),
      minimum,
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(
      Number(await operationHandle.getAttribute("aria-valuenow")),
      minimum + 8,
    );
    assert.equal(
      await operationHandle.evaluate(
        (node) => getComputedStyle(node).outlineStyle,
      ),
      "solid",
    );
    const beforeCancel = Number(
      await operationHandle.getAttribute("aria-valuenow"),
    );
    grip = await operationHandle.boundingBox();
    await page.mouse.move(grip.x + grip.width - 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width + 48, grip.y + grip.height / 2, {
      steps: 3,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(
      Number(await operationHandle.getAttribute("aria-valuenow")),
      beforeCancel,
      "Escape cancels an active resize",
    );
    assert.equal(await operationHandle.getAttribute("data-resizing"), null);
    assert.equal(
      await page
        .getByRole("columnheader", { name: "Started", exact: true })
        .getAttribute("aria-sort"),
      "descending",
      "Resizing does not sort",
    );

    // Rem-based defaults track the root text size; explicit widths remain CSS pixels.
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--reload-timeline&viewMode=story&globals=theme:${theme}`,
    );
    await page
      .getByRole("separator", { name: "Resize Started column" })
      .waitFor();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Resize Started column"]')
          ?.getAttribute("aria-valuenow") === "360",
    );

    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--controlled-column-widths&viewMode=story&globals=theme:${theme}`,
    );
    const controlledHandle = page.getByRole("separator", {
      name: "Resize Duration column",
    });
    await controlledHandle.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await controlledHandle.getAttribute("aria-valuenow"), "168");
    await page.getByRole("button", { name: "Reset column widths" }).click();
    assert.equal(await controlledHandle.getAttribute("aria-valuenow"), "128");

    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--narrow-with-long-content&viewMode=story&globals=theme:${theme}`,
    );
    await page
      .getByRole("separator", { name: "Resize Operation column" })
      .waitFor();
    const narrow = await page
      .locator(".even-table-scroll")
      .evaluate((viewport) => {
        const node = viewport.querySelector("table");
        const operationText = node.querySelector(
          '[data-row-kind="trace"] .even-trace-operation-action .even-trace-cell-content',
        );
        return {
          contained: document.documentElement.scrollWidth <= window.innerWidth,
          scrollable: viewport.scrollWidth > viewport.clientWidth,
          tableWidth: node.getBoundingClientRect().width,
          scrollWidth: viewport.scrollWidth,
          clipped: operationText.scrollWidth > operationText.clientWidth,
          rowHeight: Math.max(
            ...[...node.querySelectorAll('[data-row-kind="trace"]')].map(
              (row) => row.getBoundingClientRect().height,
            ),
          ),
        };
      });
    assert.equal(narrow.contained, true);
    assert.equal(narrow.scrollable, true);
    assert.equal(narrow.clipped, true);
    assert.ok(
      Math.abs(narrow.scrollWidth - narrow.tableWidth) < 1,
      "Long content stays inside fixed columns",
    );
    assert.ok(
      narrow.rowHeight <= initialGeometry.rowHeight + 1,
      "Long values do not wrap or increase row height",
    );

    // Anchored ellipsis masks whole graphemes and preserves full accessible labels.
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--character-ellipsis&viewMode=story&globals=theme:${theme}`,
    );
    const ellipsisHandle = page.getByRole("separator", {
      name: "Resize Operation column",
      exact: true,
    });
    await ellipsisHandle.waitFor();
    const ellipsisOperation = page.getByRole("button", {
      name: "Investigate deployment failure across production",
      exact: true,
    });
    const operationText = ellipsisOperation.locator(".even-trace-cell-content");
    assert.equal(
      await operationText.evaluate(
        (node) => node.scrollWidth > node.clientWidth,
      ),
      true,
    );
    await operationText.locator(".even-cell-overflow-marker").waitFor();
    const markers = await page
      .locator(".even-trace-operation .even-cell-overflow")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          right: node.getBoundingClientRect().right,
          markerRight: node
            .querySelector(".even-cell-overflow-marker")
            .getBoundingClientRect().right,
          overflow: node.hasAttribute("data-overflow"),
        })),
      );
    assert.ok(
      markers.every(
        (item) =>
          item.overflow && Math.abs(item.right - item.markerRight) < 0.1,
      ),
      "Ellipses sit at the same right inset, regardless of the last visible glyph",
    );
    assert.ok(
      markers.every(
        (item) => Math.abs(item.markerRight - markers[0].markerRight) < 0.1,
      ),
    );
    const native = await operationText.evaluate((root) => {
      const text = root.querySelector(".even-cell-overflow-text");
      const origin = text.getBoundingClientRect().left;
      const range = document.createRange();
      const glyphs = [
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text.textContent,
        ),
      ].map(({ index, segment }) => {
        range.setStart(text.firstChild, index);
        range.setEnd(text.firstChild, index + segment.length);
        const rect = range.getBoundingClientRect();
        return { left: rect.left - origin, right: rect.right - origin };
      });
      return {
        glyphs,
        origin,
        marker: root
          .querySelector(".even-cell-overflow-marker")
          .getBoundingClientRect().width,
        inset:
          root.closest("td").getBoundingClientRect().width -
          root.getBoundingClientRect().width,
      };
    });
    async function resizeEllipsis(width) {
      const current = await page
        .locator('th[data-column-id="operation"]')
        .evaluate((node) => node.getBoundingClientRect().width);
      const grip = await ellipsisHandle.boundingBox();
      const x = grip.x + grip.width - 2,
        y = grip.y + grip.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + width - current, y, { steps: 4 });
      await page.mouse.up();
    }
    const textPlane = operationText.locator(".even-cell-overflow-text");
    // Widths between two character edges must paint the same complete prefix.
    for (const fraction of [0.25, 0.75]) {
      await resizeEllipsis(
        native.inset +
          native.marker +
          native.glyphs[24].left +
          (native.glyphs[24].right - native.glyphs[24].left) * fraction,
      );
      await page.waitForFunction(
        ({ node, expected }) => {
          const text = node.querySelector(".even-cell-overflow-text");
          const hidden = parseFloat(text.style.clipPath.split(" ")[1]);
          return (
            Math.abs(text.getBoundingClientRect().width - hidden - expected) <
            0.1
          );
        },
        {
          node: await operationText.elementHandle(),
          expected: native.glyphs[23].right,
        },
      );
    }
    await resizeEllipsis(
      native.inset + native.marker + native.glyphs[24].right + 0.5,
    );
    await page.waitForFunction(
      ({ node, expected }) => {
        const text = node.querySelector(".even-cell-overflow-text");
        const hidden = parseFloat(text.style.clipPath.split(" ")[1]);
        return (
          Math.abs(text.getBoundingClientRect().width - hidden - expected) < 0.1
        );
      },
      {
        node: await operationText.elementHandle(),
        expected: native.glyphs[24].right,
      },
    );
    assert.ok(
      Math.abs(
        (await textPlane.evaluate(
          (node) => node.getBoundingClientRect().left,
        )) - native.origin,
      ) < 0.1,
      "The text stays anchored while the right-edge mask moves",
    );
    await ellipsisHandle.focus();
    await page.keyboard.press("End");
    assert.equal(
      await operationText.evaluate(
        (node) => node.scrollWidth > node.clientWidth,
      ),
      false,
      "Widening restores the complete label",
    );
    await operationText
      .locator(".even-cell-overflow-marker")
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Reset column width", exact: true })
      .click();
    assert.equal(await ellipsisHandle.getAttribute("aria-valuenow"), "200");
    assert.equal(
      await operationText.evaluate(
        (node) => node.scrollWidth > node.clientWidth,
      ),
      true,
    );
    assert.equal(
      await ellipsisOperation.count(),
      1,
      "Truncation preserves the full accessible label",
    );
    await ellipsisOperation.click();
    assert.equal(await ellipsisOperation.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page
        .getByRole("button", {
          name: "Read deployment logs 👩🏽‍💻 and retry",
          exact: true,
        })
        .count(),
      1,
    );

    // Native inline ellipsis is an isolated story, with a live baseline toggle.
    await page.goto(
      `${base}/iframe.html?id=workbench-tracetable--inline-ellipsis-experiment&viewMode=story&globals=theme:${theme}`,
    );
    const inlineToggle = page.getByRole("button", {
      name: "Inline ellipsis",
      exact: true,
    });
    const inlineHandle = page.getByRole("separator", {
      name: "Resize Operation column",
      exact: true,
    });
    const inlineOperation = page.getByRole("button", {
      name: "Investigate deployment failure across production",
      exact: true,
    });
    const inlineText = inlineOperation.locator(".even-cell-overflow-text");
    await inlineToggle.waitFor();
    assert.equal(await inlineToggle.getAttribute("aria-pressed"), "true");
    assert.equal(
      await inlineText.evaluate((node) => node.scrollWidth > node.clientWidth),
      true,
    );
    await inlineHandle.focus();
    await page.keyboard.press("End");
    assert.equal(
      await inlineText.evaluate((node) => node.scrollWidth > node.clientWidth),
      false,
      "Widening restores the full inline label",
    );
    await page
      .getByRole("button", { name: "Reset column width", exact: true })
      .click();
    assert.equal(
      await inlineText.evaluate((node) => node.scrollWidth > node.clientWidth),
      true,
    );
    await inlineToggle.click();
    await inlineOperation
      .locator(".even-cell-overflow-marker")
      .waitFor({ state: "visible" });
    assert.equal(await inlineToggle.getAttribute("aria-pressed"), "false");
    await inlineToggle.click();
    await inlineOperation
      .locator(".even-cell-overflow-marker")
      .waitFor({ state: "hidden" });
    await inlineOperation.click();
    assert.equal(
      await inlineOperation.getAttribute("aria-pressed"),
      "true",
      "Inline overflow preserves full-cell activation and complete accessible names",
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${base}/iframe.html?id=primitives-button--variants-and-sizes&viewMode=story&globals=theme:${theme}`,
    );
    const primary = page.getByRole("button", {
      name: "primary compact",
      exact: true,
    });
    await primary.waitFor();
    const expectedActionBorder = new Color(
      resolveColor(theme, "action.border"),
    );
    assert.ok(
      new Color(
        await primary.evaluate((node) => getComputedStyle(node).borderTopColor),
      ).deltaE(expectedActionBorder, "OK") < 0.00001,
    );
    await primary.hover();
    assert.ok(
      new Color(
        await primary.evaluate((node) => getComputedStyle(node).borderTopColor),
      ).deltaE(expectedActionBorder, "OK") < 0.00001,
      "Filled action keeps its semantic boundary on hover",
    );
    await page.mouse.move(0, 0);
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
      `${base}/iframe.html?id=primitives-textfield--default&viewMode=story&globals=theme:${theme}`,
    );
    const placeholderInput = page.getByPlaceholder("Inspect deployment", {
      exact: true,
    });
    await placeholderInput.waitFor();
    const placeholder = await placeholderInput.evaluate((node) => ({
      color: getComputedStyle(node, "::placeholder").color,
      opacity: getComputedStyle(node, "::placeholder").opacity,
      background: getComputedStyle(node).backgroundColor,
    }));
    assert.equal(placeholder.opacity, "1");
    assert.ok(
      new Color(placeholder.color).deltaE(
        new Color(resolveColor(theme, "text.secondary")),
        "OK",
      ) < 0.00001,
      "Placeholder uses the secondary-text decision rather than the browser default",
    );
    assert.ok(
      Color.contrastWCAG21(
        new Color(placeholder.color),
        new Color(placeholder.background),
      ) >= 4.5,
      "Visible placeholder text meets AA contrast",
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
  for (const theme of themes) await checkDecisionUsage(page, base, theme);
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
      const paletteChecks = [
        ...scaleNames.flatMap((family) =>
          (family === "background"
            ? [1, 2]
            : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          ).map((step) => ({
            variable: paletteVariable(family, step),
            expected: resolveColor(theme, `${family}.${step}`, gamut),
          })),
        ),
        ...componentScales.flatMap((family) =>
          [7, 8].map((step) => ({
            variable: onFillVariable(family, step),
            expected: resolveOnFill(theme, family, step, gamut),
          })),
        ),
      ];
      const renderedPalette = await page
        .locator(`section[data-even-theme="${theme}"]`)
        .evaluate(
          (scope, checks) =>
            checks.map((check) => {
              const swatch = document.createElement("span");
              swatch.style.backgroundColor = `var(${check.variable})`;
              scope.append(swatch);
              const value = getComputedStyle(swatch).backgroundColor;
              swatch.remove();
              return value;
            }),
          paletteChecks,
        );
      paletteChecks.forEach((check, index) => {
        assert.ok(
          new Color(renderedPalette[index]).deltaE(
            new Color(check.expected),
            "OK",
          ) < 0.00001,
          `${theme} ${gamut}: ${check.variable} must render the authored palette value`,
        );
        assert.ok(
          Math.abs(
            new Color(renderedPalette[index]).alpha -
              new Color(check.expected).alpha,
          ) <=
            (renderedPalette[index].startsWith("rgba(") ? 1 / 255 : 0.000001),
          `${theme} ${gamut}: ${check.variable} preserves alpha within browser serialization precision`,
        );
      });
      // Paint the browser-resolved alpha over the browser-resolved canvas.
      const composites = await page
        .locator(`section[data-even-theme="${theme}"]`)
        .evaluate((scope) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const context = canvas.getContext("2d");
          const sample = document.createElement("span");
          scope.append(sample);
          const read = (variable) => {
            sample.style.backgroundColor = `var(${variable})`;
            return getComputedStyle(sample).backgroundColor;
          };
          const background = read("--even-palette-background-1");
          const results = Array.from({ length: 10 }, (_, index) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = background;
            context.fillRect(0, 0, 1, 1);
            context.fillStyle = read(`--even-palette-gray-alpha-${index + 1}`);
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data];
          });
          sample.remove();
          return results;
        });
      composites.forEach((pixel, index) => {
        const expected = new Color(
          resolveColor(theme, `neutral.${index + 1}`, gamut),
        ).to("srgb").coords;
        expected.forEach((channel, component) =>
          assert.ok(
            Math.abs(pixel[component] - Math.round(channel * 255)) <= 1,
            `${theme} ${gamut}: gray-alpha.${index + 1} composites to neutral.${index + 1} within one 8-bit level`,
          ),
        );
      });
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
    sample.style.border = "var(--even-size-border-control) solid transparent";
    scope.append(sample);
    document.body.append(scope);
    try {
      document.documentElement.style.fontSize = "16px";
      const normal = {
        width: getComputedStyle(sample).width,
        height: getComputedStyle(sample).minHeight,
        border: getComputedStyle(sample).borderTopWidth,
      };
      document.documentElement.style.fontSize = "20px";
      const enlarged = {
        width: getComputedStyle(sample).width,
        height: getComputedStyle(sample).minHeight,
        border: getComputedStyle(sample).borderTopWidth,
      };
      return { normal, enlarged };
    } finally {
      scope.remove();
      document.documentElement.style.fontSize = previous;
    }
  });
  assert.deepEqual(dimensionMeasurements, {
    normal: { width: "8px", height: "40px", border: "1px" },
    enlarged: { width: "10px", height: "50px", border: "1px" },
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
