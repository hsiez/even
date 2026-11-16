import assert from "node:assert/strict";
import Color from "colorjs.io";
import { resolveColor } from "../src/tokens/colors.js";

// Exercise rendered states and independent decisions, rather than CSS declarations.
export async function checkDecisionUsage(page, base, theme) {
  const open = async (id, selector) => {
    await page.goto(
      `${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
    );
    await page.locator(selector).first().waitFor();
  };
  const style = (node, property) =>
    node.evaluate(
      (node, property) => getComputedStyle(node)[property],
      property,
    );
  const override = (name, value) =>
    page.evaluate(
      ([name, value]) =>
        document.documentElement.style.setProperty(name, value),
      [name, value],
    );
  const colorMatches = (actual, decision, message) =>
    assert.ok(
      new Color(actual).deltaE(new Color(resolveColor(theme, decision)), "OK") <
        0.00001,
      `${theme}: ${message}`,
    );

  await open("primitives-button--variants-and-sizes", ".even-button");
  const ghost = page.getByRole("button", {
    name: "ghost default",
    exact: true,
  });
  await page.mouse.move(0, 0);
  assert.equal(new Color(await style(ghost, "backgroundColor")).alpha, 0);
  await ghost.hover();
  colorMatches(
    await style(ghost, "backgroundColor"),
    "surface.hover",
    "Ghost hover is visible",
  );
  await page.mouse.down();
  try {
    colorMatches(
      await style(ghost, "backgroundColor"),
      "surface.active",
      "Ghost press is visible",
    );
  } finally {
    await page.mouse.up();
  }
  const padding = await style(ghost, "paddingTop");
  await override("--even-space-gap-tight", "2rem");
  assert.equal(
    await style(ghost, "paddingTop"),
    padding,
    "Changing gaps must not change control padding",
  );
  await override("--even-space-inset-tight", "0.75rem");
  assert.equal(
    await style(ghost, "paddingTop"),
    "12px",
    "Small padding follows the inset decision",
  );

  await open("workbench-tracetable--selected-row", "tr[data-selected]");
  const row = page.locator("tr[data-selected]");
  const operation = row.locator(".even-trace-operation-action");
  for (const state of ["rest", "hover", "focus"]) {
    if (state === "rest") await page.mouse.move(0, 0);
    if (state === "hover") await operation.hover();
    if (state === "focus") {
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await operation.focus();
    }
    const background = await style(row, "backgroundColor");
    colorMatches(
      background,
      "selection.background",
      `Selected surface survives ${state}`,
    );
    for (const target of [row.locator("td").first(), operation]) {
      const foreground = await style(target, "color");
      colorMatches(
        foreground,
        "selection.foreground",
        `Selected text survives ${state}`,
      );
      assert.ok(
        Color.contrastWCAG21(new Color(foreground), new Color(background)) >=
          4.5,
      );
    }
    assert.equal(
      new Color(await style(operation, "backgroundColor")).alpha,
      0,
      "Full-cell action exposes the selected row surface",
    );
    const status = row.locator(".even-trace-status");
    colorMatches(
      await style(status, "color"),
      "status.error.text",
      "Outcome keeps its status foreground",
    );
    colorMatches(
      await style(status, "backgroundColor"),
      "status.error.compact-surface",
      "Outcome keeps its status surface",
    );
    if (state === "focus") {
      assert.equal(await style(operation, "outlineStyle"), "solid");
      assert.ok(
        Color.contrastWCAG21(
          new Color(await style(operation, "outlineColor")),
          new Color(background),
        ) >= 3,
      );
    }
  }
  await override("--even-focus-ring", "#ff00ff");
  const handle = page.locator(".even-column-resizer").first();
  await handle.hover();
  const edge = await handle.evaluate(
    (node) => getComputedStyle(node, "::after").borderInlineEndColor,
  );
  colorMatches(
    edge,
    "border.interaction",
    "Pointer edge is independent of keyboard focus",
  );

  await open("primitives-tabs--default", ".even-tab[data-active]");
  const tab = page.locator(".even-tab[data-active]");
  await override("--even-focus-ring", "#ff00ff");
  colorMatches(
    await style(tab, "borderBottomColor"),
    "selection.indicator",
    "Persistent selection is independent of keyboard focus",
  );

  await open("primitives-textfield--error", ".even-input");
  await override("--even-status-error-text", "#008000");
  colorMatches(
    await style(page.locator(".even-input"), "borderTopColor"),
    "border.invalid",
    "Invalid boundary is independent of error text",
  );

  await open(
    "workbench-tracetoolbar--default",
    ".even-trace-toolbar > .even-field",
  );
  const field = page.locator(".even-trace-toolbar > .even-field");
  const basis = await style(field, "flexBasis");
  await override("--even-size-navigation-preferred", "32rem");
  assert.equal(
    await style(field, "flexBasis"),
    basis,
    "Navigation width must not change field sizing",
  );
  await override("--even-size-field-preferred", "20rem");
  assert.equal(
    await style(field, "flexBasis"),
    "320px",
    "Field width follows its own decision",
  );

  for (const [id, selector] of [
    ["workbench-payloadviewer--default", ".even-payload pre"],
    ["workbench-attributelist--default", ".even-detail-section pre"],
  ]) {
    await open(id, selector);
    const code = page.locator(selector).first();
    assert.ok(
      (await style(code, "fontFamily")).includes("Geist Mono Variable"),
      "Technical content uses the shared data font",
    );
    await override("--even-font-data", '"Courier New", monospace');
    assert.ok(
      (await style(code, "fontFamily")).includes("Courier New"),
      "Technical content follows data-font changes",
    );
  }

  for (const [id, selector, action] of [
    ["primitives-dialog--initially-open", ".even-dialog-popup"],
    ["primitives-menu--initially-open", ".even-menu-popup"],
    ["primitives-popover--initially-open", ".even-popover-popup"],
    ["primitives-select--default", ".even-select-popup", "select"],
    ["primitives-tooltip--default", ".even-tooltip-popup", "tooltip"],
  ]) {
    await open(id, ".even-button");
    if (action === "select") await page.getByRole("combobox").click();
    if (action === "tooltip")
      await page.getByRole("button", { name: "Refresh traces" }).hover();
    const popup = page.locator(selector);
    await popup.waitFor();
    const shadow = await style(popup, "boxShadow");
    const expected = await popup.evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.boxShadow = "var(--even-shadow-floating)";
      node.append(probe);
      const value = getComputedStyle(probe).boxShadow;
      probe.remove();
      return value;
    });
    assert.notEqual(shadow, "none", `${theme}: ${selector} casts a shadow`);
    assert.equal(
      shadow,
      expected,
      `${theme}: ${selector} shares the floating shadow decision`,
    );
    const ink = new Color(shadow.match(/^(?:rgba?|oklch|color)\([^)]*\)/)[0]);
    assert.ok(
      ink.to("srgb").coords.every((channel) => Math.abs(channel) < 1e-6),
      "Cast shadows use black in either theme",
    );
    assert.ok(
      ink.alpha > 0 && ink.alpha < 1,
      "Cast shadows remain translucent",
    );
    await override("--even-shadow-floating", "none");
    assert.equal(
      await style(popup, "boxShadow"),
      "none",
      "Floating surfaces preserve decision overrides",
    );
  }
}
