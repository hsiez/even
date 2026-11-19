import assert from "node:assert/strict";
import Color from "colorjs.io";
import { checkTabMotion } from "./check-tab-motion.mjs";
import { checkStickyTabs } from "./check-sticky-tabs.mjs";

function hoverGeometry(node) {
  const wrapper = node.closest(".even-workbench-tab");
  const track = wrapper.closest(".even-workbench-tab-track");
  const hover = getComputedStyle(wrapper, "::before");
  const top =
    wrapper.getBoundingClientRect().top +
    parseFloat(getComputedStyle(wrapper).borderTopWidth) +
    parseFloat(hover.top);
  const bottom = top + parseFloat(hover.height);
  const label = node
    .querySelector(".even-workbench-tab-label")
    .getBoundingClientRect();
  const activeLabel = track
    .querySelector(
      '[role="tab"][aria-selected="true"] .even-workbench-tab-label',
    )
    .getBoundingClientRect();
  const indicator = track.querySelector(".even-workbench-tab-indicator");
  const active = indicator.getBoundingClientRect();
  const stroke = parseFloat(getComputedStyle(indicator).borderLeftWidth);
  const outerRadius = parseFloat(
    getComputedStyle(indicator).borderTopLeftRadius,
  );
  const innerRadius = parseFloat(hover.borderBottomRightRadius);
  const left =
    wrapper.getBoundingClientRect().left +
    parseFloat(getComputedStyle(wrapper).borderLeftWidth) +
    parseFloat(hover.left);
  const right = left + parseFloat(hover.width);
  const beforeActive = right <= active.left;
  return {
    above: label.top - top,
    below: bottom - label.bottom,
    labelBottom: label.bottom,
    activeLabelBottom: activeLabel.bottom,
    hoverBottom: bottom,
    activeBottom: active.bottom,
    innerRadius,
    outerRadius,
    bottomGap: active.bottom - stroke - bottom,
    sideGap: beforeActive ? active.left - right : left - active.right,
    curveCenterOffset: beforeActive
      ? right - innerRadius - (active.left + stroke - outerRadius)
      : left + innerRadius - (active.right - stroke + outerRadius),
  };
}

function assertHoverClearance(edges) {
  assert.ok(
    Math.abs(edges.sideGap - edges.bottomGap) < 0.5,
    `Hover has equal side and bottom clearance from the painted border: ${JSON.stringify(edges)}`,
  );
  assert.ok(
    Math.abs(edges.curveCenterOffset) < 0.5,
    "Hover corner and adjacent active shoulder share a horizontal center",
  );
}

function closeGeometry(node) {
  const target = node.getBoundingClientRect();
  const style = getComputedStyle(node, "::before");
  const left = target.left + parseFloat(style.left);
  const top = target.top + parseFloat(style.top);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  const track = node.closest(".even-workbench-tab-track");
  const owner = track.querySelector(
    `.even-workbench-tab[data-tab-column="${node.dataset.tabColumn}"]`,
  );
  const active = !!owner.querySelector(".even-tab[data-active]");
  const parent = owner;
  const bounds = parent.getBoundingClientRect();
  const surface = getComputedStyle(parent, active ? null : "::before");
  const parentLeft = active
    ? bounds.left
    : bounds.left +
      parseFloat(getComputedStyle(parent).borderLeftWidth) +
      parseFloat(surface.left);
  const parentTop = active
    ? bounds.top
    : bounds.top +
      parseFloat(getComputedStyle(parent).borderTopWidth) +
      parseFloat(surface.top);
  const parentWidth = active ? bounds.width : parseFloat(surface.width);
  const parentHeight = active ? bounds.height : parseFloat(surface.height);
  return {
    width,
    height,
    targetWidth: target.width,
    targetHeight: target.height,
    rightGap: parentLeft + parentWidth - left - width,
    verticalGap: (parentHeight - height) / 2,
    inside:
      left > parentLeft &&
      top > parentTop &&
      left + width < parentLeft + parentWidth &&
      top + height < parentTop + parentHeight,
    radius: parseFloat(style.borderTopRightRadius),
    parentRadius: parseFloat(surface.borderTopRightRadius),
  };
}

function assertCloseGeometry(geometry) {
  assert.ok(
    geometry.width < geometry.targetWidth &&
      geometry.height < geometry.targetHeight &&
      geometry.targetWidth >= 24 &&
      geometry.targetHeight >= 24,
    "The smaller visual highlight retains a usable target",
  );
  assert.ok(geometry.inside, "Close highlight stays inside its tab surface");
  assert.ok(
    Math.abs(geometry.rightGap - geometry.verticalGap) < 0.5,
    "Close highlight has matching right and vertical clearance",
  );
  assert.ok(
    geometry.radius < geometry.parentRadius,
    "Close highlight uses a smaller inner corner radius",
  );
}

// Hover may reveal a control via native scrolling; inspect its resting hover
// only after the same idle cooldown that users experience.
async function scrollIdle(page) {
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
  );
}

async function settled(page) {
  await page.waitForFunction(() => {
    const frame = document.querySelector(".even-tabs-design-frame");
    const indicator = frame?.querySelector(".even-workbench-tab-indicator");
    const tab = frame?.querySelector('[role="tab"][aria-selected="true"]');
    if (!indicator || indicator.hidden || !tab) return false;
    const actual = indicator.getBoundingClientRect();
    const expected = tab.closest(".even-workbench-tab").getBoundingClientRect();
    return (
      !frame.querySelector(".even-workbench-tab-track[data-scrolling]") &&
      Math.abs(actual.left - expected.left) < 1 &&
      Math.abs(actual.width - expected.width) < 1
    );
  });
}

export async function checkWorkbenchTabs(page, base, theme, axe) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--design-sandbox&viewMode=story&globals=theme:${theme}`,
  );
  await page
    .getByRole("heading", { name: "Tool errors", exact: true })
    .waitFor();
  await page.getByRole("combobox", { name: "Tab size" }).click();
  await page.getByRole("option", { name: "Current", exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  const frame = page.locator(".even-tabs-design-frame");
  await frame.evaluate((node) => {
    node.style.width = "960px";
  });
  await settled(page);
  await page.screenshot({ path: `/tmp/even-tab-density-${theme}.png` });
  const indicator = page.locator(".even-workbench-tab-indicator");
  await page.getByRole("tab", { name: "Traces", exact: true }).hover();
  await scrollIdle(page);
  await page.screenshot({ path: `/tmp/even-tab-inactive-hover-${theme}.png` });
  // Hover crosses two semantic controls, but must remain one visual tab.
  for (const name of ["Playground 1", "Tool errors"]) {
    const tab = page.getByRole("tab", { name, exact: true });
    const close = page.getByRole("button", {
      name: `Close ${name}`,
      exact: true,
    });
    const active = (await tab.getAttribute("aria-selected")) === "true";
    const pseudo = active ? null : "::before";
    const fill = await tab.evaluateHandle((node) =>
      node.getAttribute("aria-selected") === "true"
        ? node
            .closest(".even-workbench-tab-track")
            .querySelector(".even-workbench-tab-indicator")
        : node.closest(".even-workbench-tab"),
    );
    await page.mouse.move(0, 0);
    assert.equal(
      await close.evaluate((node) => getComputedStyle(node).opacity),
      "0",
      "Close control is hidden at rest",
    );
    const resting = await fill.evaluate(
      (node, pseudo) => getComputedStyle(node, pseudo).backgroundColor,
      pseudo,
    );
    await tab.hover();
    await scrollIdle(page);
    assert.equal(
      await close.evaluate((node) => getComputedStyle(node).opacity),
      "1",
      "Hovering the tab reveals its close control",
    );
    if (!active)
      await page.waitForFunction(
        ({ node, resting, pseudo }) =>
          getComputedStyle(node, pseudo).backgroundColor !== resting,
        { node: fill, resting, pseudo },
      );
    const surface = await fill.evaluate(
      (node, pseudo) => getComputedStyle(node, pseudo).backgroundColor,
      pseudo,
    );
    if (!active) {
      const edges = await tab.evaluate(hoverGeometry);
      assertHoverClearance(edges);
      assert.ok(
        Math.abs(edges.above - edges.below) < 1,
        "Inactive hover has balanced space above and below its label",
      );
      assert.ok(
        Math.abs(edges.labelBottom - edges.activeLabelBottom) < 1,
        "Inactive and active labels remain aligned",
      );
      assert.ok(
        edges.hoverBottom < edges.activeBottom - 1,
        "Hover retains bottom clearance for the active curve",
      );
      assert.ok(
        Math.abs(
          edges.innerRadius +
            edges.activeBottom -
            edges.hoverBottom -
            edges.outerRadius,
        ) < 1,
        "Hover radius plus clearance matches the active curve radius",
      );
    }
    if (active)
      assert.equal(
        surface,
        resting,
        "The active tab has no hover surface change",
      );
    const normalIcon = await close.evaluate(
      (node) => getComputedStyle(node).color,
    );
    const hoveredLabel = await tab.evaluate(
      (node) => getComputedStyle(node).color,
    );
    const restingContainer = await close.evaluate((node) => ({
      color: getComputedStyle(node).color,
      background: getComputedStyle(node, "::before").backgroundColor,
    }));
    assert.equal(
      restingContainer.background,
      "rgba(0, 0, 0, 0)",
      "Revealing the X does not add a resting container",
    );
    assert.ok(
      Color.contrast(restingContainer.color, surface, "WCAG21") >= 4.5,
      "Resting X remains readable on its tab surface",
    );
    await close.hover();
    await scrollIdle(page);
    assertCloseGeometry(await close.evaluate(closeGeometry));
    await page.screenshot({
      path: `/tmp/even-tab-close-${active ? "active" : "inactive"}-${theme}.png`,
    });
    assert.equal(
      await tab.evaluate((node) => getComputedStyle(node).color),
      hoveredLabel,
      "Tab label retains its hover foreground over the close control",
    );
    assert.equal(
      await close.evaluate((node) => getComputedStyle(node).opacity),
      "1",
      "Close control stays visible when the pointer moves onto it",
    );
    assert.equal(
      await fill.evaluate(
        (node, pseudo) => getComputedStyle(node, pseudo).backgroundColor,
        pseudo,
      ),
      surface,
      "Tab surface persists over its close control",
    );
    const icon = await close.evaluate((node) => ({
      color: getComputedStyle(node).color,
      background: getComputedStyle(node, "::before").backgroundColor,
    }));
    assert.notEqual(
      icon.background,
      restingContainer.background,
      "Direct X hover adds its highlight",
    );
    assert.notEqual(
      icon.background,
      "rgba(0, 0, 0, 0)",
      "The close control retains its hover background",
    );
    assert.notEqual(
      icon.background,
      surface,
      "The close highlight layers visibly over the tab surface",
    );
    assert.equal(
      icon.color,
      normalIcon,
      "Close icon keeps its neutral foreground on hover",
    );
    assert.ok(
      Color.contrast(icon.color, icon.background, "WCAG21") >= 4.5,
      "The emphasized icon remains readable on the hovered tab",
    );
    await fill.dispose();
  }
  await page.screenshot({ path: `/tmp/even-tab-close-hover-${theme}.png` });
  await frame.evaluate((node) =>
    node.style.setProperty("--even-size-radius-panel", "0.75rem"),
  );
  await settled(page);
  const neighbor = page.getByRole("tab", { name: "Traces", exact: true });
  await neighbor.hover();
  await scrollIdle(page);
  const derived = await neighbor.evaluate(hoverGeometry);
  assertHoverClearance(derived);
  assert.ok(
    derived.innerRadius > 4 &&
      Math.abs(
        derived.innerRadius +
          derived.activeBottom -
          derived.hoverBottom -
          derived.outerRadius,
      ) < 1,
    "Inner radius follows a changed outer-radius decision",
  );
  await frame.evaluate((node) =>
    node.style.removeProperty("--even-size-radius-panel"),
  );
  await settled(page);
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".even-workbench-tab-track")
        .hasAttribute("data-scrolling"),
  );
  const target = await page
    .getByRole("tab", { name: "Traces", exact: true })
    .elementHandle();
  // Pause the real CSS transition midway, rather than depending on wall-clock
  // timing on a busy CI host. This checks interpolation in a rendered browser.
  const motion = await indicator.evaluate(async (node, target) => {
    const start = node.getBoundingClientRect().left;
    target.click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const animation = node
      .getAnimations()
      .find((item) => item.transitionProperty === "transform");
    if (!animation) return { found: false };
    animation.pause();
    animation.currentTime = animation.effect.getTiming().duration / 2;
    await new Promise(requestAnimationFrame);
    const middle = node.getBoundingClientRect().left;
    const end = target
      .closest(".even-workbench-tab")
      .getBoundingClientRect().left;
    const selected = target.getAttribute("aria-selected");
    animation.finish();
    return { found: true, start, middle, end, selected };
  }, target);
  assert.ok(motion.found, "Selection creates a lateral indicator transition");
  assert.equal(
    motion.selected,
    "true",
    "Selection does not wait for decoration to arrive",
  );
  assert.ok(
    motion.middle > Math.min(motion.start, motion.end) + 1 &&
      motion.middle < Math.max(motion.start, motion.end) - 1,
    "The indicator passes through an intermediate position",
  );
  await settled(page);

  const widths = () =>
    page
      .locator(".even-workbench-tab")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().width),
      );
  const initial = await widths();
  initial.forEach((width) =>
    assert.ok(Math.abs(width - 192) < 1, "Few tabs stop at the maximum width"),
  );
  const add = async () => {
    await page.getByRole("button", { name: "New tab", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "New trace explorer", exact: true })
      .click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
  };
  for (let n = 0; n < 3; n++) await add();
  await settled(page);
  const shared = await widths();
  await page.screenshot({ path: `/tmp/even-tab-compressed-${theme}.png` });
  assert.equal(shared.length, 6);
  assert.ok(
    shared[0] < initial[0] - 5 && shared[0] > 128,
    "Adding tabs shrinks them before introducing overflow",
  );
  shared.forEach((width) =>
    assert.ok(Math.abs(width - shared[0]) < 1, "Tabs share equal width"),
  );
  for (let n = 0; n < 3; n++) await add();
  await settled(page);
  (await widths()).forEach((width) =>
    assert.ok(Math.abs(width - 128) < 1, "Tabs stop shrinking at the minimum"),
  );
  const scroll = page.locator(".even-workbench-tab-scroll");
  assert.ok(
    await scroll.evaluate((node) => node.scrollWidth > node.clientWidth),
    "The strip scrolls at minimum width",
  );
  assert.ok(
    await page
      .getByRole("tab", { name: "Playground 1", exact: true })
      .locator(".even-workbench-tab-label")
      .evaluate(
        (node) =>
          getComputedStyle(node).maskImage !== "none" &&
          getComputedStyle(node).textOverflow === "clip",
      ),
    "Tab labels fade beneath the close target while retaining their accessible name",
  );
  await frame.evaluate((node) => {
    node.style.width = "360px";
  });
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".even-workbench-tab-scroll");
    const tab = viewport.querySelector('[role="tab"][aria-selected="true"]');
    const visible = viewport.getBoundingClientRect(),
      selected = tab.getBoundingClientRect();
    return (
      selected.left >= visible.left - 1 && selected.right <= visible.right + 1
    );
  });
  await settled(page);
  const plus = await page
    .getByRole("button", { name: "New tab", exact: true })
    .boundingBox();
  const box = await frame.boundingBox();
  assert.ok(
    plus.x + plus.width <= box.x + box.width,
    "The new-tab control remains reachable",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("tab", { name: "Traces", exact: true }).click();
  await settled(page);
  assert.equal(
    await indicator.evaluate((node) => node.getAnimations().length),
    0,
    "Reduced motion selects without a transition",
  );
  await page.mouse.move(0, 0);
  await page.getByRole("tab", { name: "Traces", exact: true }).press("Tab");
  const keyboardClose = page.getByRole("button", {
    name: "Close Tool errors",
    exact: true,
  });
  assert.ok(
    await keyboardClose.evaluate((node) => node === document.activeElement),
    "Keyboard can reach the close control",
  );
  assert.equal(
    await keyboardClose.evaluate((node) => getComputedStyle(node).opacity),
    "1",
    "Keyboard focus reveals the close control",
  );
  await page.addScriptTag({ content: axe });
  assert.deepEqual(
    await page.evaluate(
      async () =>
        (
          await window.axe.run(document.body, {
            rules: { region: { enabled: false } },
          })
        ).violations,
    ),
    [],
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log(
    `Verified ${theme} shared tab/close hover, icon contrast, indicator motion, equal-width compression, minimum overflow, container resizing and reduced motion.`,
  );
  await checkSizeOptions(page, base, theme, axe);
  await checkTabDividers(page, base, theme);
  await checkOverflowFades(page, base, theme, axe);
  await checkTabTypeIcons(page, base, theme);
  await checkImmediateCreation(page, base, theme);
  await checkTabMotion(page, base, theme);
  await checkStickyTabs(page, base, theme, axe);
  await checkTokenResilience(page, base, theme);
}

export async function checkImmediateCreation(page, base, theme) {
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
  );
  const add = page.getByRole("button", { name: "New trace tab", exact: true });
  await add.waitFor();
  assert.equal(await page.getByRole("tab").count(), 3);
  await add.click();
  const fourth = page.getByRole("tab", { name: "Traces 4", exact: true });
  await fourth.waitFor();
  assert.equal(await fourth.getAttribute("aria-selected"), "true");
  assert.equal(
    await page.getByRole("menu").count(),
    0,
    "Direct creation never opens a menu",
  );
  await page.waitForFunction(
    (node) => node === document.activeElement,
    await fourth.elementHandle(),
  );
  await add.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Traces 5", exact: true }).waitFor();
  await add.dblclick();
  const seventh = page.getByRole("tab", { name: "Traces 7", exact: true });
  await seventh.waitFor();
  assert.equal(
    await page.getByRole("tab").count(),
    7,
    "Rapid creation retains every appended tab",
  );
  await page
    .locator(".even-tabs-design-frame")
    .evaluate((node) => (node.style.width = "360px"));
  assert.ok(
    await page
      .locator(".even-workbench-tab-scroll")
      .evaluate((node) => node.scrollWidth > node.clientWidth),
    "Direct-create fixture supports overflow review",
  );
  await page
    .getByRole("button", { name: "Close Traces 7", exact: true })
    .click();
  const replacement = page.getByRole("tab", { name: "Traces 6", exact: true });
  assert.equal(await replacement.getAttribute("aria-selected"), "true");
  await page.waitForFunction(
    (node) => node === document.activeElement,
    await replacement.elementHandle(),
  );
  assert.equal(await page.getByRole("menu").count(), 0);
  console.log(
    `Verified ${theme} immediate story-only tab creation, keyboard focus, rapid clicks, overflow and closure without a dropdown.`,
  );
}

async function checkTabTypeIcons(page, base, theme) {
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--design-sandbox&viewMode=story&globals=theme:${theme}`,
  );
  const traces = page.getByRole("tab", { name: "Traces", exact: true });
  const chat = page.getByRole("tab", { name: "Playground 1", exact: true });
  await traces.waitFor();
  await chat.waitFor();
  assert.equal(await traces.locator("svg.lucide-list-tree").count(), 1);
  assert.equal(await chat.locator("svg.lucide-message-square").count(), 1);
  for (const rootSize of [16, 20]) {
    await page.evaluate(
      (size) => (document.documentElement.style.fontSize = `${size}px`),
      rootSize,
    );
    for (const tab of [traces, chat]) {
      const geometry = await tab.evaluate((node) => {
        const icon = node.querySelector(".even-workbench-tab-icon");
        const label = node.querySelector(".even-workbench-tab-label");
        const box = icon.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          gap: label.getBoundingClientRect().left - box.right,
          color: getComputedStyle(icon).color,
          tabColor: getComputedStyle(node).color,
          mask: getComputedStyle(icon).maskImage,
          hidden: icon.getAttribute("aria-hidden"),
          focusable: icon.getAttribute("focusable"),
        };
      });
      assert.equal(geometry.width, rootSize);
      assert.equal(geometry.height, rootSize);
      assert.equal(geometry.gap, rootSize / 2);
      assert.equal(geometry.color, geometry.tabColor);
      assert.equal(
        geometry.mask,
        "none",
        "Only the title fades; the leading icon remains clear",
      );
      assert.equal(geometry.hidden, "true");
      assert.equal(geometry.focusable, "false");
    }
  }
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "New chat playground", exact: true })
    .click();
  const created = page.getByRole("tab", { name: "Playground 3", exact: true });
  await created.waitFor();
  assert.equal(await created.locator("svg.lucide-message-square").count(), 1);
  await page.screenshot({ path: `/tmp/even-lucide-tab-types-${theme}.png` });
  console.log(
    `Verified ${theme} trace/chat tab icons, decorative semantics, current-color inheritance and token-scaled sizing/spacing.`,
  );
}

async function checkOverflowFades(page, base, theme, axe) {
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
  );
  await page.getByRole("tab", { name: "Traces", exact: true }).waitFor();
  const tabs = page.getByRole("tab");
  assert.equal(await tabs.count(), 60, "Overflow story exercises many tabs");
  const scroll = page.locator(".even-workbench-tab-scroll");
  const plus = page.getByRole("button", { name: "New tab", exact: true });
  async function cornerClearance() {
    await page.waitForFunction(() => {
      const active = document.querySelector(".even-workbench-tab-indicator");
      const selected = document.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      const plus = document.querySelector(".even-workbench-new");
      const radius = parseFloat(getComputedStyle(active).borderTopRightRadius);
      const box = active.getBoundingClientRect();
      return (
        Math.abs(
          box.left -
            selected.closest(".even-workbench-tab").getBoundingClientRect()
              .left,
        ) < 0.5 &&
        box.right + radius <= plus.getBoundingClientRect().left + radius + 0.5
      );
    });
  }
  async function edges(start, end) {
    await page.waitForFunction(
      ({ start, end }) => {
        const node = document.querySelector(".even-workbench-tab-scroll");
        return (
          node.hasAttribute("data-overflow-start") === start &&
          node.hasAttribute("data-overflow-end") === end
        );
      },
      { start, end },
    );
    assert.deepEqual(
      await scroll.evaluate((node) => {
        const track = node.firstElementChild;
        return ["::before", "::after"].map(
          (pseudo) => getComputedStyle(track, pseudo).opacity === "1",
        );
      }),
      [start, end],
      "Only overflowing edges fade behind the active layer",
    );
  }
  await edges(false, true);
  const plusShape = await plus.evaluate((node) => {
    const style = getComputedStyle(node);
    const active = document.querySelector(".even-workbench-tab-indicator");
    return {
      outline: style.borderTopColor,
      shoulder: getComputedStyle(node, "::after").content,
      highlight: getComputedStyle(node, "::before").opacity,
      height: node.getBoundingClientRect().height,
      activeHeight: active.getBoundingClientRect().height,
      overlap:
        node.previousElementSibling.getBoundingClientRect().right -
        node.getBoundingClientRect().left,
    };
  });
  assert.equal(plusShape.outline, "rgba(0, 0, 0, 0)");
  assert.equal(plusShape.shoulder, "none");
  assert.equal(plusShape.highlight, "0");
  assert.equal(plusShape.height, plusShape.activeHeight);
  assert.ok(plusShape.overlap > 0, "Flat plus stays fixed over the strip edge");
  const plusBox = await plus.boundingBox();
  const barBox = await plus.locator("..").boundingBox();
  const baseline = await page.screenshot({
    clip: {
      x: plusBox.x - 2,
      y: barBox.y + barBox.height - 1,
      width: plusBox.width + 4,
      height: 1,
    },
    scale: "css",
  });
  const continuous = await page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      return pixels.every((channel, index) => channel === pixels[index % 4]);
    },
    `data:image/png;base64,${baseline.toString("base64")}`,
  );
  assert.ok(
    continuous,
    "The strip baseline stays continuous across both plus edges",
  );
  await plus.hover();
  await scrollIdle(page);
  assert.equal(
    await plus.evaluate((node) => getComputedStyle(node, "::before").opacity),
    "1",
    "Plus uses an inset hover highlight like an inactive tab",
  );
  await page.mouse.move(0, 0);
  await scroll.evaluate((node) => {
    node.scrollLeft = node.clientWidth / 2;
  });
  await edges(true, true);
  await page.screenshot({
    path: `/tmp/even-tabs-overflow-middle-${theme}.png`,
  });
  const long = tabs.nth(9);
  const fullName = await long.textContent();
  await long.focus();
  await long.press("Enter");
  await page.waitForFunction(() => {
    const node = document.querySelector('[role="tab"][aria-selected="true"]');
    const box = node.getBoundingClientRect();
    const viewport = node
      .closest(".even-workbench-tab-scroll")
      .getBoundingClientRect();
    const plus = document
      .querySelector(".even-workbench-new")
      .getBoundingClientRect();
    return box.left >= viewport.left && box.right <= plus.left;
  });
  const label = long.locator(".even-workbench-tab-label");
  assert.ok(
    await label.evaluate((node) => node.scrollWidth > node.clientWidth),
    "Long labels overflow their visible area",
  );
  await page
    .getByRole("button", { name: `Close ${fullName}`, exact: true })
    .hover();
  await scrollIdle(page);
  await page.screenshot({ path: `/tmp/even-tabs-title-fade-${theme}.png` });
  await long.focus();
  await long.press("End");
  await edges(true, false);
  await cornerClearance();
  await plus.hover();
  await scrollIdle(page);
  const plusClearance = await plus.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const hover = getComputedStyle(node, "::before");
    const active = node
      .closest(".even-workbench-tab-bar")
      .querySelector(".even-workbench-tab-indicator");
    const activeBox = active.getBoundingClientRect();
    const stroke = parseFloat(style.borderLeftWidth);
    const left = box.left + stroke + parseFloat(hover.left);
    const bottom =
      box.top +
      parseFloat(style.borderTopWidth) +
      parseFloat(hover.top) +
      parseFloat(hover.height);
    const radius = parseFloat(hover.borderBottomLeftRadius);
    const outerRadius = parseFloat(
      getComputedStyle(active).borderTopRightRadius,
    );
    return {
      side: left - activeBox.right,
      below: activeBox.bottom - stroke - bottom,
      centerOffset: left + radius - (activeBox.right - stroke + outerRadius),
      insideTarget:
        left >= box.left && left + parseFloat(hover.width) <= box.right,
    };
  });
  assert.ok(
    Math.abs(plusClearance.side - plusClearance.below) < 0.5 &&
      Math.abs(plusClearance.centerOffset) < 0.5 &&
      plusClearance.insideTarget,
    "Plus hover matches the inactive tab clearance and concentric curve inside its target",
  );
  const last = await tabs.last().boundingBox();
  const plusBounds = await plus.boundingBox();
  assert.ok(
    last.x + last.width <= plusBounds.x + 1,
    "The last selected tab remains clear of the overlapping plus",
  );
  await page.screenshot({ path: `/tmp/even-tabs-overflow-end-${theme}.png` });
  await plus.click();
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (node) => node === document.activeElement,
    await plus.elementHandle(),
  );
  assert.ok(
    await plus.evaluate((node) => node === document.activeElement),
    "Overlapping plus retains menu dismissal and focus restoration",
  );
  await tabs.last().focus();
  await page.keyboard.press("Home");
  await edges(false, true);
  await page.setViewportSize({ width: 390, height: 800 });
  await tabs.first().focus();
  await page.keyboard.press("End");
  await edges(true, false);
  await cornerClearance();
  await page.screenshot({
    path: `/tmp/even-tabs-overflow-narrow-${theme}.png`,
  });
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    "Tab overflow stays within the strip on mobile",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  // Fewer tabs remove both fades when the strip no longer overflows.
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--default&viewMode=story&globals=theme:${theme}`,
  );
  await page.getByRole("tab", { name: "Traces", exact: true }).waitFor();
  await page.waitForFunction(() => {
    const node = document.querySelector(".even-workbench-tab-scroll");
    return (
      !node.hasAttribute("data-overflow-start") &&
      !node.hasAttribute("data-overflow-end")
    );
  });
  assert.equal(
    await scroll.evaluate((node) => getComputedStyle(node).maskImage),
    "none",
  );
  await page.setViewportSize({ width: 390, height: 800 });
  await edges(false, true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => {
    const node = document.querySelector(".even-workbench-tab-scroll");
    return (
      !node.hasAttribute("data-overflow-start") &&
      !node.hasAttribute("data-overflow-end")
    );
  });
  await tabs.last().click();
  await cornerClearance();
  await page.addScriptTag({ content: axe });
  assert.deepEqual(
    await page.evaluate(
      async () =>
        (
          await window.axe.run(document.body, {
            rules: { region: { enabled: false } },
          })
        ).violations,
    ),
    [],
  );
  console.log(
    `Verified ${theme} 60-tab overflow, edge fades, title fade, keyboard reveal and inactive-style plus menu.`,
  );
}

async function checkTabDividers(page, base, theme) {
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
  );
  const tabs = page.getByRole("tablist").locator(".even-workbench-tab");
  await page.getByRole("tab", { name: "Traces 2", exact: true }).waitFor();
  await page.mouse.move(0, 0);
  const widths = await tabs.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().width),
  );
  async function expectDividers(active, hovered = -1) {
    const actual = await tabs.evaluateAll((nodes) =>
      nodes.map((node) => {
        if (node.querySelector(".even-tab[data-active]")) return false;
        const divider = getComputedStyle(node, "::after");
        return divider.content !== "none" && Number(divider.opacity) > 0;
      }),
    );
    assert.deepEqual(
      actual,
      actual.map(
        (_, index) =>
          index > 0 &&
          ![active, hovered].includes(index) &&
          ![active, hovered].includes(index - 1),
      ),
      "Only boundaries between inactive, unhovered tabs have dividers",
    );
  }
  await expectDividers(0);
  await page.screenshot({ path: `/tmp/even-tab-dividers-${theme}.png` });
  await page.getByRole("tab", { name: "Traces 3", exact: true }).hover();
  await scrollIdle(page);
  await expectDividers(0, 2);
  await page.screenshot({ path: `/tmp/even-tab-dividers-hover-${theme}.png` });
  await page
    .getByRole("button", { name: "Close Traces 3", exact: true })
    .hover();
  await scrollIdle(page);
  await expectDividers(0, 2);
  assert.deepEqual(
    await tabs.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().width),
    ),
    widths,
    "Absorbing dividers leaves tab widths unchanged",
  );
  const middle = page.getByRole("tab", { name: "Traces 6", exact: true });
  await middle.click();
  await page.mouse.move(0, 0);
  await expectDividers(5);
  await middle.press("ArrowRight");
  await expectDividers(6);
  console.log(
    `Verified ${theme} inactive dividers, absorption through tab/close hover, pointer and keyboard selection, and stable widths.`,
  );
}

async function checkSizeOptions(page, base, theme, axe) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--size-comparison&viewMode=story&globals=theme:${theme}`,
  );
  const profiles = [
    {
      label: "Current",
      width: 192,
      height: 40,
      closeWidth: 32,
      closeHeight: 32,
    },
    {
      label: "Compact",
      width: 160,
      height: 36,
      closeWidth: 28,
      closeHeight: 28,
    },
    { label: "Dense", width: 144, height: 32, closeWidth: 24, closeHeight: 24 },
  ];
  for (const profile of profiles) {
    const region = page.getByRole("region", {
      name: `${profile.label} tab sizing`,
      exact: true,
    });
    const tab = region.getByRole("tab", { name: "Tool errors", exact: true });
    await tab.waitFor();
    const measured = await tab.evaluate((node) => ({
      width: node.closest(".even-workbench-tab").getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));
    assert.ok(
      Math.abs(measured.width - profile.width) < 1,
      `${profile.label} maximum width`,
    );
    assert.ok(
      Math.abs(measured.height - profile.height) < 1,
      `${profile.label} control height`,
    );
    const close = region.getByRole("button", {
      name: "Close Tool errors",
      exact: true,
    });
    const target = await close.boundingBox();
    assert.ok(
      Math.abs(target.width - profile.closeWidth) < 1 &&
        Math.abs(target.height - profile.closeHeight) < 1,
      `${profile.label} close hover footprint`,
    );
    assert.ok(
      target.width >= 24 && target.height >= 24,
      "Close controls retain at least a 24px target at the reference root size",
    );
    const inactive = region.getByRole("tab", { name: "Traces", exact: true });
    await inactive.hover();
    await scrollIdle(page);
    const edges = await inactive.evaluate(hoverGeometry);
    assertHoverClearance(edges);
    assert.ok(
      Math.abs(edges.above - edges.below) < 1,
      `${profile.label} hover centers its label`,
    );
    assert.ok(
      Math.abs(edges.labelBottom - edges.activeLabelBottom) < 1,
      `${profile.label} labels retain the active baseline`,
    );
    assert.ok(
      Math.abs(
        edges.innerRadius +
          edges.activeBottom -
          edges.hoverBottom -
          edges.outerRadius,
      ) < 1,
      `${profile.label} hover keeps concentric corner radii`,
    );
    await close.hover();
    await scrollIdle(page);
    const closeSize = await close.evaluate(closeGeometry);
    assertCloseGeometry(closeSize);
    assert.ok(
      Math.abs(closeSize.width - (profile.closeWidth - 8)) < 1 &&
        Math.abs(closeSize.height - (profile.closeHeight - 8)) < 1,
      `${profile.label} close highlight is inset within its target`,
    );
    const icon = await close.evaluate((node) => ({
      color: getComputedStyle(node).color,
      background: getComputedStyle(node, "::before").backgroundColor,
    }));
    assert.ok(Color.contrast(icon.color, icon.background, "WCAG21") >= 4.5);
  }
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `/tmp/even-tab-size-comparison-${theme}.png` });
  await page.addScriptTag({ content: axe });
  assert.deepEqual(
    await page.evaluate(
      async () =>
        (
          await window.axe.run(document.body, {
            rules: { region: { enabled: false } },
          })
        ).violations,
    ),
    [],
  );
  for (const profile of profiles) {
    const region = page.getByRole("region", {
      name: `${profile.label} tab sizing`,
      exact: true,
    });
    await region.getByRole("tab", { name: "Traces", exact: true }).click();
    await region
      .getByRole("tab", { name: "Traces", exact: true })
      .press("ArrowRight");
    assert.equal(
      await region
        .getByRole("tab", { name: "Tool errors", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    const before = await page
      .locator(".even-tabs-size-comparison > section")
      .evaluateAll((regions) =>
        regions.map((node) => node.querySelectorAll('[role="tab"]').length),
      );
    await region
      .getByRole("button", { name: "Close Tool errors", exact: true })
      .click();
    assert.ok(
      await region
        .getByRole("tab", { name: "Playground 1", exact: true })
        .evaluate((node) => node === document.activeElement),
    );
    const after = await page
      .locator(".even-tabs-size-comparison > section")
      .evaluateAll((regions) =>
        regions.map((node) => node.querySelectorAll('[role="tab"]').length),
      );
    after.forEach((count, index) =>
      assert.equal(
        count,
        before[index] - Number(profiles[index] === profile),
        "Sizing comparisons retain independent tab state",
      ),
    );
  }
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--design-sandbox&viewMode=story&globals=theme:${theme}`,
  );
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .click();
  await page.getByRole("tab", { name: "Traces 4", exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Tab size" }).click();
  await page.getByRole("option", { name: "Dense", exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("tab", { name: "Traces 4", exact: true })
      .getAttribute("aria-selected"),
    "true",
    "Changing preview size preserves tabs and selection",
  );
  console.log(
    `Verified ${theme} sizing profiles, close footprints, keyboard closure, instance isolation and live size switching.`,
  );
}

async function checkTokenResilience(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
  );
  const selected = page.getByRole("tab", { selected: true });
  await page.getByRole("tab", { name: "Traces 5", exact: true }).click();
  const frame = page.locator(".even-tabs-design-frame");
  await frame.evaluate((node) => {
    node.style.setProperty("--even-space-inset-compact", "0.75rem");
    node.style.setProperty("--even-size-radius-panel", "1.5rem");
  });
  async function verify() {
    const close = page.locator(".even-workbench-tab-close[data-active-tab]");
    await close.hover();
    await scrollIdle(page);
    const measured = await close.evaluate((node) => {
      const bar = node.closest(".even-workbench-tab-bar");
      const row = bar.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const outer = row.getBoundingClientRect();
      const target = node.getBoundingClientRect();
      const highlight = getComputedStyle(node, "::before");
      const top = target.top + parseFloat(highlight.top) - outer.top;
      const right =
        outer.right -
        target.left -
        parseFloat(highlight.left) -
        parseFloat(highlight.width);
      return {
        top,
        right,
        height: outer.height,
        minimum: parseFloat(
          getComputedStyle(row.querySelector(".even-tab")).minHeight,
        ),
        plusHeight: bar
          .querySelector(".even-workbench-new")
          .getBoundingClientRect().height,
        radius: parseFloat(highlight.borderTopRightRadius),
        expectedRadius: Math.max(
          0,
          parseFloat(getComputedStyle(row).borderTopRightRadius) - right,
        ),
      };
    });
    assert.ok(
      measured.height > measured.minimum,
      "The fixture grows beyond its minimum control height",
    );
    assert.ok(
      Math.abs(measured.top - measured.right) < 0.5,
      `Rendered height controls close alignment: ${JSON.stringify(measured)}`,
    );
    assert.ok(
      Math.abs(measured.plusHeight - measured.height) < 0.5,
      "Plus height follows the rendered tab row",
    );
    assert.ok(
      Math.abs(measured.radius - measured.expectedRadius) < 0.5,
      "Close corners remain concentric as spacing and radius decisions change",
    );
  }
  await verify();
  await page.addStyleTag({
    content:
      ".even-tabs-design-frame .even-tab {font-size:1.5rem;line-height:1.8}",
  });
  await verify();
  await page.evaluate(() => (document.documentElement.style.fontSize = "20px"));
  await verify();
  await page
    .locator(".even-workbench-tab-scroll")
    .evaluate((node) => (node.scrollLeft = 3000));
  await verify();
  await selected.press("End");
  await page
    .locator(".even-workbench-tab-scroll")
    .evaluate((node) => (node.scrollLeft = 0));
  await verify();
  await page.screenshot({
    path: `/tmp/even-tabs-token-resilience-${theme}.png`,
  });
  await frame.evaluate((node) => (node.style.zoom = "1.25"));
  await page.waitForFunction(() => {
    const row = document.querySelector(
      ".even-workbench-tab:has(.even-tab[data-active])",
    );
    const plus = document.querySelector(".even-workbench-new");
    return (
      Math.abs(
        row.getBoundingClientRect().height -
          plus.getBoundingClientRect().height,
      ) < 0.5
    );
  });
}
