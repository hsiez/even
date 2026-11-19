import assert from "node:assert/strict";

export async function checkTabMotion(page, base, theme) {
  const url = `${base}/iframe.html?id=workbench-workbenchtabs--design-sandbox&viewMode=story&globals=theme:${theme}`;
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const track = page.locator(".even-workbench-tab-track");
  const plus = page.getByRole("button", { name: "New tab", exact: true });
  const create = async () => {
    await plus.click();
    await page
      .getByRole("menuitem", { name: "New trace explorer", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector(".even-workbench-tab-track")
        .hasAttribute("data-creating"),
    );
  };
  const pose = async (time) =>
    page.evaluate(async (time) => {
      const track = document.querySelector(".even-workbench-tab-track");
      window.__evenTabMotion ??= track
        .getAnimations({ subtree: true })
        .filter((a) => a.id.startsWith("even-tab-"));
      for (const animation of window.__evenTabMotion) {
        animation.pause();
        animation.currentTime = Math.min(
          time,
          animation.effect.getTiming().duration,
        );
      }
      await new Promise(requestAnimationFrame);
      const rows = [...track.querySelectorAll(".even-workbench-tab")];
      return {
        entering: new DOMMatrixReadOnly(getComputedStyle(rows.at(-1)).transform)
          .m41,
        previous: rows[1].getBoundingClientRect().left,
        indicator: track
          .querySelector(".even-workbench-tab-indicator")
          .getBoundingClientRect().left,
        target: rows.at(-1).getBoundingClientRect().left,
        width: track
          .querySelector(".even-workbench-tab-indicator")
          .getBoundingClientRect().width,
      };
    }, time);
  const finish = async () => {
    await page.evaluate(() => {
      window.__evenTabMotion?.forEach((a) => a.finish());
      delete window.__evenTabMotion;
    });
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".even-workbench-tab-track")
          .hasAttribute("data-creating"),
    );
  };
  await page.goto(url);
  await plus.click();
  const menu = page.getByRole("menu");
  const origin = await menu.evaluate((node) => ({
    coordinates: getComputedStyle(node)
      .transformOrigin.split(" ")
      .map(parseFloat),
    width: node.offsetWidth,
    side: node.dataset.side,
    align: node.dataset.align,
  }));
  assert.equal(origin.side, "bottom");
  assert.equal(origin.align, "end");
  assert.ok(
    origin.coordinates[0] > origin.width * 0.85 && origin.coordinates[1] < 1,
    "Menu grows from its top-right trigger origin rather than its center",
  );
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector(".even-workbench-tab-track")
      .hasAttribute("data-creating"),
  );
  const entering = await pose(100);
  assert.ok(
    entering.entering > 1 &&
      Math.abs(entering.indicator - entering.previous) < 2,
    "New tab enters from the right while the indicator follows the previous tab left",
  );
  await page.screenshot({ path: `/tmp/even-tab-create-enter-${theme}.png` });
  const inserted = await pose(200);
  assert.ok(
    Math.abs(inserted.entering) < 0.5 &&
      inserted.indicator < inserted.target - 10,
    "Tab insertion completes before the indicator moves to its new target",
  );
  const focusing = await pose(310);
  assert.ok(
    focusing.indicator > inserted.indicator + 10 &&
      focusing.indicator < focusing.target - 1,
    "Indicator then slides right onto the new tab",
  );
  await page.screenshot({ path: `/tmp/even-tab-create-focus-${theme}.png` });
  await finish();
  const created = page.getByRole("tab", { name: "Traces 4", exact: true });
  await page.waitForFunction(
    (node) => node === document.activeElement,
    await created.elementHandle(),
  );
  assert.equal(await created.getAttribute("aria-selected"), "true");

  // Compaction changes the target size once; the outline only translates.
  await page.goto(url);
  await page.locator(".even-tabs-design-frame").evaluate((node) => {
    node.style.width = "600px";
  });
  await create();
  const compactStart = await pose(0);
  const compactMiddle = await pose(100);
  const compactFocus = await pose(310);
  assert.ok(
    Math.abs(compactStart.width - compactMiddle.width) < 0.5 &&
      Math.abs(compactStart.width - compactFocus.width) < 0.5,
    "Active outline translates without width interpolation during compaction",
  );
  await finish();

  // A moving close target must still receive its first click.
  await page.goto(url);
  await create();
  await pose(80);
  const close = page.getByRole("button", {
    name: "Close Tool errors",
    exact: true,
  });
  await close.hover({ force: true });
  const box = await close.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page
    .getByRole("tab", { name: "Tool errors", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await created.getAttribute("aria-selected"), "true");
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".even-workbench-tab-track")
        .hasAttribute("data-creating"),
  );

  // Consecutive creations replace decoration without losing either tab.
  await page.goto(url);
  await create();
  await pose(80);
  await create();
  await page.evaluate(() => {
    delete window.__evenTabMotion;
  });
  await pose(310);
  await finish();
  assert.equal(await page.getByRole("tab").count(), 5);
  assert.equal(
    await page
      .getByRole("tab", { name: "Traces 5", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );

  // Resizing cancels projected geometry and leaves the selection usable.
  await page.goto(url);
  await create();
  await pose(80);
  await page.locator(".even-tabs-design-frame").evaluate((node) => {
    node.style.width = "360px";
  });
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".even-workbench-tab-track")
        .hasAttribute("data-creating"),
  );
  assert.equal(await created.getAttribute("aria-selected"), "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await plus.click();
  assert.equal(await menu.evaluate((node) => node.getAnimations().length), 0);
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .click();
  assert.equal(await created.getAttribute("aria-selected"), "true");
  assert.equal(
    await track.evaluate((node) => node.hasAttribute("data-creating")),
    false,
  );
  assert.equal(
    await track.evaluate(
      (node) => node.getAnimations({ subtree: true }).length,
    ),
    0,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log(
    `Verified ${theme} trigger-origin menu, staged tab creation, pointer interruption, rapid creation, resize cancellation and reduced motion.`,
  );
}

export async function checkTabRemovalMotion(page, base, theme) {
  const url = `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`;
  const track = page.locator(".even-workbench-tab-track");
  const viewport = page.locator(".even-workbench-tab-scroll");
  const add = page.getByRole("button", { name: "New trace tab", exact: true });
  const loadOverflow = async () => {
    await page.goto(url);
    await add.waitFor();
    await page
      .locator(".even-tabs-design-frame")
      .evaluate((node) => (node.style.width = "560px"));
    // Setup through the keyboard skips decorative creation motion.
    for (let i = 0; i < 8; i++) {
      await add.focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
  };
  const pose = async (time) =>
    page.evaluate(async (time) => {
      const track = document.querySelector(".even-workbench-tab-track");
      const animations = track
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap");
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
      await new Promise(requestAnimationFrame);
      const row = track
        .querySelector(".even-tab[data-active]")
        .closest(".even-workbench-tab");
      const box = row.getBoundingClientRect();
      const close = track
        .querySelector(".even-workbench-tab-close[data-active-tab]")
        .getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform);
      const milliseconds = (purpose) => {
        const value = getComputedStyle(track)
          .getPropertyValue(
            purpose === "removal"
              ? "--even-interaction-delay-removal"
              : "--even-motion-duration-reflow",
          )
          .trim();
        return parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
      };
      return {
        count: animations.length,
        total: animations[0]?.effect.getTiming().duration,
        gap:
          (animations[0]?.effect.getKeyframes()[1]?.offset ?? 0) *
          (animations[0]?.effect.getTiming().duration ?? 0),
        left: box.left,
        right: box.right,
        width: box.width,
        closeRight: close.right,
        scale: matrix.a,
        hold: milliseconds("removal"),
        move: milliseconds("move"),
      };
    }, time);
  const finish = async () => {
    await track.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap")
        .forEach((a) => a.finish()),
    );
    await page.waitForFunction(
      () => !document.querySelector(".even-workbench-tab-track[data-removing]"),
    );
  };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await loadOverflow();
  const previous = await page
    .getByRole("tab", { name: "Traces 10", exact: true })
    .evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
  await page
    .getByRole("button", { name: "Close Traces 11", exact: true })
    .click();
  assert.equal(
    await page.getByRole("tab", { name: "Traces 11", exact: true }).count(),
    0,
    "Removed tab leaves the accessible tree immediately",
  );
  const start = await pose(0);
  assert.equal(start.hold, 75, "Removal has a 75ms gap hold");
  assert.equal(start.move, 150, "Removal slides over 150ms");
  assert.equal(start.total, 225, "The running removal animation lasts 225ms");
  assert.equal(
    start.hold + start.move,
    225,
    "Total removal choreography is 225ms",
  );
  assert.ok(start.count > 0, "Pointer removal starts gap choreography");
  assert.ok(
    Math.abs(start.left - previous.x) < 1,
    "Surviving tab first stays in its old position, leaving the removed slot empty",
  );
  const held = await pose(start.hold / 2);
  assert.ok(
    Math.abs(held.left - start.left) < 1,
    "The gap remains visible for the removal beat",
  );
  await page.screenshot({ path: `/tmp/even-tab-remove-gap-${theme}.png` });
  const middle = await pose(start.hold + start.move / 2);
  assert.ok(
    middle.left > start.left + 5 && middle.left < start.left + start.width - 5,
    "Left overflow slides into the gap after the hold",
  );
  assert.equal(
    middle.scale,
    1,
    "The active tab is translated without stretching",
  );
  assert.ok(
    Math.abs(
      middle.closeRight - middle.right - (start.closeRight - start.right),
    ) < 1,
    "Close control moves with the active outline",
  );
  await page.screenshot({ path: `/tmp/even-tab-remove-slide-${theme}.png` });
  await finish();
  const final = await page
    .getByRole("tab", { name: "Traces 10", exact: true })
    .evaluate(
      (node) =>
        node.closest(".even-workbench-tab").getBoundingClientRect().left,
    );
  assert.ok(
    Math.abs(final - start.left - start.width) < 1,
    "Survivors finish one slot to the right",
  );
  assert.ok(
    await viewport.evaluate(
      (node) =>
        Math.abs(node.scrollLeft - (node.scrollWidth - node.clientWidth)) < 2,
    ),
    "Removal leaves no obsolete end gap",
  );

  // Repeated pointer closes retain a short spatial cue without another hold.
  await page
    .getByRole("button", { name: "Close Traces 10", exact: true })
    .click();
  const next = await pose(0);
  assert.equal(
    next.total,
    100,
    "A repeated close uses the short reflow timing",
  );
  assert.equal(next.gap, 0, "A repeated close skips the gap hold");
  await pose(35);
  const beforeInterrupt = await page
    .getByRole("tab", { name: "Traces 8", exact: true })
    .evaluate(
      (node) =>
        node.closest(".even-workbench-tab").getBoundingClientRect().left,
    );
  await page
    .getByRole("button", { name: "Close Traces 9", exact: true })
    .click();
  const interrupted = await pose(0);
  assert.equal(
    interrupted.total,
    100,
    "Further quick closes replace the current slide",
  );
  assert.ok(
    Math.abs(interrupted.left - beforeInterrupt) < 1,
    "Repeated closes continue from the painted pose without snapping",
  );
  await finish();
  await page.getByRole("tab", { name: "Traces 8", exact: true }).focus();
  await page.keyboard.press("Delete");
  assert.equal(
    await track.getAttribute("data-removing"),
    null,
    "Keyboard removal has no decorative delay",
  );

  // The same staging works without strip overflow and does not depend on fixed
  // timing constants. Caller decision overrides are consumed by WAAPI too.
  await page.goto(url);
  await track.waitFor();
  await track.evaluate((node) => {
    node.style.setProperty("--even-interaction-delay-removal", "100ms");
    node.style.setProperty("--even-motion-duration-reflow", "250ms");
  });
  const remaining = await page
    .getByRole("tab", { name: "Playground 1", exact: true })
    .evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
  await page
    .getByRole("button", { name: "Close Tool errors", exact: true })
    .click();
  const ordinary = await pose(0);
  assert.ok(
    Math.abs(ordinary.left - remaining.x) < 1,
    "Middle removal preserves a visible gap without overflow",
  );
  assert.equal(ordinary.hold, 100);
  assert.equal(ordinary.move, 250);
  await pose(100);
  await finish();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadOverflow();
  await page
    .getByRole("button", { name: "Close Traces 11", exact: true })
    .click();
  assert.equal(await track.getAttribute("data-removing"), null);
  assert.equal(
    await track.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((a) => a.id === "even-tab-remove-gap").length,
    ),
    0,
    "Reduced motion closes and compacts immediately",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log(
    `Verified ${theme} staged removal gap, slide, fixed outline/close geometry, interruption, timing overrides, keyboard immediacy and reduced motion.`,
  );
}

export async function checkDenseRemoval(page, base, theme) {
  const track = page.locator(".even-workbench-tab-track");
  const viewport = page.locator(".even-workbench-tab-scroll");
  const finish = async () => {
    await track.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap")
        .forEach((a) => a.finish()),
    );
    await page.waitForFunction(
      () =>
        !document.querySelector(
          ".even-workbench-tab-track[data-removing], .even-workbench-tab-track[data-scrolling]",
        ),
    );
  };
  await page.setViewportSize({ width: 1000, height: 700 });
  for (const [selected, edge] of [
    [59, "start"],
    [2, "end"],
    [30, "middle"],
  ]) {
    await page.goto(
      `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
    );
    await page.getByRole("tab").first().waitFor();
    const selectedTab = page.getByRole("tab").nth(selected);
    await selectedTab.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (node) => node.getAttribute("aria-selected") === "true",
      await selectedTab.elementHandle(),
    );
    await page.waitForFunction(
      () =>
        !document.querySelector(
          ".even-workbench-tab-track[data-indicator-moving]",
        ),
    );
    await viewport.evaluate((node, edge) => {
      node.scrollLeft =
        edge === "start"
          ? 0
          : edge === "end"
            ? node.scrollWidth
            : node.scrollWidth / 2;
    }, edge);
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
    const before = await viewport.evaluate((node) => node.scrollLeft);
    await page.locator(".even-workbench-tab-close[data-active-tab]").click();
    const motion = await track.evaluate(async (node) => {
      const animations = node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap");
      animations.forEach((a) => {
        a.pause();
        a.currentTime = 70;
      });
      await new Promise(requestAnimationFrame);
      const row = node
        .querySelector(".even-tab[data-active]")
        .closest(".even-workbench-tab")
        .getBoundingClientRect();
      const close = node
        .querySelector(".even-workbench-tab-close[data-active-tab]")
        .getBoundingClientRect();
      return {
        removing: node.hasAttribute("data-removing"),
        count: animations.length,
        width: row.width,
        gap: row.right - close.right,
        vertical: close.top - row.top,
        closeHeight: close.height,
        height: row.height,
        scroll: node.parentElement.scrollLeft,
        limit: node.parentElement.scrollWidth - node.parentElement.clientWidth,
      };
    });
    assert.ok(
      motion.removing && motion.count >= 2,
      "60-tab edge-pinned removal preserves both row and close choreography",
    );
    assert.equal(motion.width, 128, "The dense strip is at minimum width");
    assert.ok(
      motion.gap >= 0 &&
        motion.gap < 10 &&
        Math.abs(motion.vertical - (motion.height - motion.closeHeight) / 2) <
          1,
      "Pinned replacement and X share the same pose",
    );
    assert.ok(
      Math.abs(motion.scroll - Math.min(before, motion.limit)) < 2,
      "Focus and replacement selection do not jump to a distant logical slot",
    );
    await finish();
    assert.equal(await page.getByRole("tab").count(), 59);
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("role") === "tab" &&
        document.activeElement.getAttribute("aria-selected") === "true",
    );
  }

  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
  );
  const add = page.getByRole("button", { name: "New trace tab", exact: true });
  await add.waitFor();
  await page
    .locator(".even-tabs-design-frame")
    .evaluate((node) => (node.style.width = "960px"));
  for (let i = 0; i < 4; i++) {
    await add.focus();
    await page.keyboard.press("Enter");
  }
  await page.getByRole("tab", { name: "Traces", exact: true }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector(
        ".even-workbench-tab-track[data-scrolling], .even-workbench-tab-track[data-indicator-moving]",
      ),
  );
  for (const label of ["Tool errors", "Playground 1"]) {
    // These cases audit hover during isolated animated removals. Rapid-repeat
    // compaction is exercised separately below, without a wait between clicks.
    await page.waitForTimeout(550);
    const close = page.getByRole("button", {
      name: `Close ${label}`,
      exact: true,
    });
    const box = await close.boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await close.click();
    await track.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap")
        .forEach((a) => {
          a.pause();
          a.currentTime = 80;
        }),
    );
    assert.ok(
      await track.evaluate((node) =>
        [...node.querySelectorAll(".even-workbench-tab")].every(
          (tab) =>
            getComputedStyle(tab, "::before").backgroundColor ===
            "rgba(0, 0, 0, 0)",
        ),
      ),
      "Moving tabs do not acquire pointer hover",
    );
    assert.ok(
      await track.evaluate((node) =>
        [...node.querySelectorAll(".even-workbench-tab-close")].every(
          (close) =>
            getComputedStyle(close, "::before").backgroundColor ===
            "rgba(0, 0, 0, 0)",
        ),
      ),
      "Close hover is suppressed for the same movement interval",
    );
    await finish();
    // Do not move the cursor: layout alone must reconcile the hovered tab/X.
    // Motion cleanup queues a React presentation update. Wait for that commit,
    // rather than reading halfway between the WAAPI finish and the next paint.
    await page.waitForFunction((point) => {
      const track = document.querySelector(".even-workbench-tab-track");
      const hit = document
        .elementFromPoint(point.x, point.y)
        ?.closest("[data-tab-column]");
      const tab = track.querySelector(".even-workbench-tab[data-hovered]");
      const close = track.querySelector(
        ".even-workbench-tab-close[data-close-hovered]",
      );
      return (
        tab?.dataset.tabColumn === hit?.dataset.tabColumn &&
        close?.dataset.tabColumn ===
          (hit?.classList.contains("even-workbench-tab-close")
            ? hit.dataset.tabColumn
            : undefined)
      );
    }, point);
    const hover = await track.evaluate((node, point) => {
      const hit = node.ownerDocument
        .elementFromPoint(point.x, point.y)
        ?.closest("[data-tab-column]");
      const tab = node.querySelector(".even-workbench-tab[data-hovered]");
      const close = node.querySelector(
        ".even-workbench-tab-close[data-close-hovered]",
      );
      return {
        hit: hit?.dataset.tabColumn,
        tab: tab?.dataset.tabColumn,
        close: close?.dataset.tabColumn,
        hitClose: hit?.classList.contains("even-workbench-tab-close"),
      };
    }, point);
    assert.equal(
      hover.tab,
      hover.hit,
      "Resting hover follows the element that actually landed beneath the stationary pointer",
    );
    assert.equal(
      hover.close,
      hover.hitClose ? hover.hit : undefined,
      "X highlight belongs only to that same hovered tab",
    );
    await page.screenshot({
      path: `/tmp/even-tab-hover-after-close-${theme}-${label.replaceAll(" ", "-")}.png`,
    });
  }
  console.log(
    `Verified ${theme} minimum-width 60-tab removal at both pinned edges and mid-list, stable focus/scroll and unified stationary-pointer hover after closure.`,
  );
}

export async function checkRemovalLeftOfActive(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const distance of [1, 3]) {
    await page.goto(
      `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
    );
    const active = page.getByRole("tab").last();
    await active.waitFor();
    await active.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (node) => node.getAttribute("aria-selected") === "true",
      await active.elementHandle(),
    );
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    await page.waitForFunction(
      () =>
        !document.querySelector(
          ".even-workbench-tab-track[data-scrolling], .even-workbench-tab-track[data-indicator-moving]",
        ),
    );
    const removed = page.getByRole("tab").nth(59 - distance);
    const predecessor = page.getByRole("tab").nth(58 - distance);
    const label = await removed.innerText();
    const predecessorLabel = await predecessor.innerText();
    const before = await predecessor.evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
    const activeBefore = await active.evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
    await page
      .getByRole("button", { name: `Close ${label}`, exact: true })
      .click();
    // Let the real post-commit measurement and scroll-clamp events run first.
    // A test that pauses in the click task misses this cancellation entirely.
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const track = page.locator(".even-workbench-tab-track");
    assert.equal(
      await track.getAttribute("data-removing"),
      "",
      "Left-of-active removal survives the asynchronous scroll clamp",
    );
    const following = page.getByRole("tab", {
      name: predecessorLabel,
      exact: true,
    });
    const pose = async (time) => {
      await track.evaluate(
        (node, time) =>
          node
            .getAnimations({ subtree: true })
            .filter((a) => a.id === "even-tab-remove-gap")
            .forEach((a) => {
              a.pause();
              a.currentTime = time;
            }),
        time,
      );
      await page.evaluate(() => new Promise(requestAnimationFrame));
      return following.evaluate((node) =>
        node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
      );
    };
    const held = await pose(37.5);
    assert.ok(
      Math.abs(held.left - before.left) < 1,
      "Tab to the left retains its old position so the closed slot is visibly empty",
    );
    await page.screenshot({
      path: `/tmp/even-left-of-active-gap-${theme}-${distance}.png`,
    });
    const sliding = await pose(150);
    assert.ok(
      sliding.left > held.left + 5 &&
        sliding.left < held.left + before.width - 5,
      "Left tabs slide right into the vacant slot after the gap beat",
    );
    const activeDuring = await active.evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
    assert.ok(
      Math.abs(activeDuring.left - activeBefore.left) < 1 &&
        Math.abs(activeDuring.width - activeBefore.width) < 1,
      "Active tab stays fixed while its left neighbors slide",
    );
    await page.screenshot({
      path: `/tmp/even-left-of-active-slide-${theme}-${distance}.png`,
    });
    await track.evaluate((node) =>
      node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap")
        .forEach((a) => a.finish()),
    );
    await page.waitForFunction(
      () => !document.querySelector(".even-workbench-tab-track[data-removing]"),
    );
    const settled = await following.evaluate((node) =>
      node.closest(".even-workbench-tab").getBoundingClientRect().toJSON(),
    );
    assert.ok(
      Math.abs(settled.left - before.left - before.width) < 1,
      "Left neighbors finish exactly one slot to the right",
    );
    assert.equal(await active.getAttribute("aria-selected"), "true");
    assert.equal(await page.getByRole("tab").count(), 59);
    assert.ok(
      await page
        .locator(".even-workbench-tab-scroll")
        .evaluate(
          (node) =>
            Math.abs(node.scrollWidth - node.clientWidth - node.scrollLeft) < 2,
        ),
      "The finished strip has no leftover end space",
    );
  }
  console.log(
    `Verified ${theme} inactive removal immediately and several slots left of the active tab with 60 tabs: real-frame gap, slide, fixed active outline and settled end range.`,
  );
}

export async function checkCreationFadeOverlap(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [count, width] of [
    [3, 960],
    [15, 960],
    [3, 600],
  ]) {
    await page.goto(
      `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
    );
    const add = page.getByRole("button", {
      name: "New trace tab",
      exact: true,
    });
    await add.waitFor();
    await page
      .locator(".even-tabs-design-frame")
      .evaluate((node, width) => (node.style.width = `${width}px`), width);
    for (let i = 3; i < count; i++) {
      await add.focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
    await add.click();
    await page.waitForFunction(() =>
      document.querySelector(".even-workbench-tab-track[data-creating]"),
    );
    await page.evaluate(
      () =>
        (window.__creationFadeAnimations = document
          .querySelector(".even-workbench-tab-track")
          .getAnimations({ subtree: true })
          .filter((a) => a.id.startsWith("even-tab-"))),
    );
    let expectedWidth;
    for (const time of [250, 310, 370]) {
      const geometry = await page.evaluate(async (time) => {
        for (const a of window.__creationFadeAnimations) {
          a.pause();
          a.currentTime = Math.min(time, a.effect.getTiming().duration);
        }
        await new Promise(requestAnimationFrame);
        const track = document.querySelector(".even-workbench-tab-track");
        const indicator = track.querySelector(".even-workbench-tab-indicator");
        return {
          box: indicator.getBoundingClientRect().toJSON(),
          scale: new DOMMatrixReadOnly(getComputedStyle(indicator).transform).a,
          fades: [
            getComputedStyle(track, "::before").opacity,
            getComputedStyle(track, "::after").opacity,
            ...[...track.querySelectorAll(".even-workbench-active-fade")].map(
              (n) => getComputedStyle(n).opacity,
            ),
          ],
        };
      }, time);
      expectedWidth ??= geometry.box.width;
      assert.ok(
        Math.abs(geometry.box.width - expectedWidth) < 1 &&
          geometry.scale === 1,
        "The creation outline keeps its width and scale throughout the slide",
      );
      assert.ok(
        geometry.fades.every((opacity) => opacity === "0"),
        "Stationary viewport/target fades cannot overlap the independently moving creation outline",
      );
      const png = (await page.screenshot()).toString("base64");
      const border = await page.evaluate(
        async ({ png, box }) => {
          const bitmap = new Image();
          bitmap.src = "data:image/png;base64," + png;
          await bitmap.decode();
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          const probe = document.createElement("canvas").getContext("2d");
          const rgb = (color) => {
            probe.clearRect(0, 0, 1, 1);
            probe.fillStyle = color;
            probe.fillRect(0, 0, 1, 1);
            return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          const node = document.querySelector(".even-workbench-tab-indicator");
          const ink = rgb(getComputedStyle(node).borderRightColor);
          const page = rgb(
            getComputedStyle(node).getPropertyValue("--even-surface-page"),
          );
          const distance = (a, b) =>
            Math.max(...a.map((v, i) => Math.abs(v - b[i])));
          let best = Infinity;
          for (
            let x = Math.floor(box.right) - 3;
            x <= Math.ceil(box.right) + 1;
            x++
          ) {
            const pixel = [
              ...context.getImageData(
                x,
                Math.floor(box.top + box.height / 2),
                1,
                1,
              ).data,
            ].slice(0, 3);
            best = Math.min(best, distance(pixel, ink));
          }
          return { best, contrast: distance(page, ink) };
        },
        { png, box: geometry.box },
      );
      assert.ok(
        border.best <= border.contrast * 0.6,
        `The painted right border remains visible near the scroll fade, allowing subpixel antialiasing: ${JSON.stringify(border)}`,
      );
      if (time === 370)
        await page.screenshot({
          path: `/tmp/even-create-uncovered-border-${theme}-${count}-${width}.png`,
        });
    }
    await page.evaluate(() => {
      window.__creationFadeAnimations.forEach((a) => a.finish());
      delete window.__creationFadeAnimations;
    });
    await page.waitForFunction(
      () => !document.querySelector(".even-workbench-tab-track[data-creating]"),
    );
    // Scroll fades return for ordinary overflow scrolling after choreography.
    if (count > 3) {
      const viewport = page.locator(".even-workbench-tab-scroll");
      await viewport.evaluate(
        (node) => (node.scrollLeft = node.scrollWidth / 2),
      );
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector(".even-workbench-tab-track"),
            "::after",
          ).opacity === "1",
      );
    }
  }
  console.log(
    `Verified ${theme} creation outline pixels and constant width across sparse, compressed and overflowing tabs; scroll masks stay clear of the moving border and restore afterward.`,
  );
}

export async function checkRapidRemovals(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
  );
  const add = page.getByRole("button", { name: "New trace tab", exact: true });
  await add.waitFor();
  for (let i = 0; i < 12; i++) {
    await add.focus();
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
  );
  const track = page.locator(".even-workbench-tab-track");
  const sample = () =>
    track.evaluate((node) => {
      const animation = node
        .getAnimations({ subtree: true })
        .find((a) => a.id === "even-tab-remove-gap");
      return animation
        ? {
            duration: animation.effect.getTiming().duration,
            hold:
              animation.effect.getKeyframes()[1].offset *
              animation.effect.getTiming().duration,
          }
        : null;
    });
  const closeImmediately = async () => {
    const box = await page
      .locator(".even-workbench-tab-close[data-active-tab]")
      .boundingBox();
    // Real input without locator.click's "wait until stable" behavior, which
    // otherwise waits out the exact motion being tested.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  for (let i = 0; i < 7; i++) {
    await closeImmediately();
    assert.equal(
      await page.getByRole("tab").count(),
      14 - i,
      "Each rapid pointer close removes one tab immediately",
    );
    const motion = await sample();
    if (i === 0) {
      assert.equal(motion.duration, 225);
      assert.equal(motion.hold, 75);
    } else {
      assert.equal(
        motion?.duration,
        100,
        "Quick repeats retain a short visible slide",
      );
      assert.equal(
        motion?.hold,
        0,
        "Quick repeats do not replay the anticipation hold",
      );
    }
    await page.waitForTimeout(i % 2 ? 0 : 35);
  }
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-removing]"),
  );
  assert.equal(
    await track.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((a) => a.id === "even-tab-remove-gap").length,
    ),
    0,
    "A burst leaves no queued removal animations",
  );
  assert.equal(await page.getByRole("tab", { selected: true }).count(), 1);
  const cycle = await track.evaluate((node) => {
    const ms = (variable) => {
      const v = getComputedStyle(node).getPropertyValue(variable).trim();
      return parseFloat(v) * (v.endsWith("ms") ? 1 : 1000);
    };
    return ms("--even-interaction-delay-repeat");
  });
  await page.waitForTimeout(cycle + 20);
  await closeImmediately();
  const isolated = await sample();
  assert.equal(
    isolated.duration,
    225,
    "After a pause, a single close retains the ordinary removal cue",
  );
  assert.equal(isolated.hold, 75);
  await track.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .filter((a) => a.id === "even-tab-remove-gap")
      .forEach((a) => a.finish()),
  );
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-removing]"),
  );
  console.log(
    `Verified ${theme} rapid native-pointer removals, immediate counts, skipped repeat holds, short continuous reflow, no queued animations and isolated-close recovery.`,
  );
}

export async function checkStationaryRemovals(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const load = async () => {
    await page.goto(
      `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
    );
    const add = page.getByRole("button", {
      name: "New trace tab",
      exact: true,
    });
    await add.waitFor();
    for (let i = 0; i < 12; i++) {
      await add.focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
    const box = await page
      .locator(".even-workbench-tab-close[data-active-tab]")
      .boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  for (const interval of [60, 100, 250, 350]) {
    const point = await load();
    // Keep exactly the same coordinates, including during the empty gap. Moving
    // to each button's measured pose hides the missed-click regression.
    for (let i = 0; i < 4; i++) {
      await page.mouse.click(point.x, point.y);
      assert.equal(
        await page.getByRole("tab").count(),
        14 - i,
        "Every stationary click removes exactly one tab",
      );
      assert.equal(
        await page
          .getByRole("tab", { name: `Traces ${15 - i}`, exact: true })
          .count(),
        0,
        "The intended trailing tab closes, with no extra or missed closure",
      );
      if (i > 0) {
        const rapid = await page
          .locator(".even-workbench-tab-track")
          .evaluate((node) => {
            const animation = node
              .getAnimations({ subtree: true })
              .find((a) => a.id === "even-tab-remove-gap");
            return (
              animation && {
                duration: animation.effect.getTiming().duration,
                gap: animation.effect.getKeyframes()[1].offset,
              }
            );
          });
        assert.equal(
          rapid?.duration,
          100,
          "Stationary repeat clicks retain a short removal cue",
        );
        assert.equal(
          rapid?.gap,
          0,
          "Stationary repeats do not restart the gap hold",
        );
      }
      if (i < 3) await page.waitForTimeout(interval);
    }
    assert.equal(
      await page
        .getByRole("tab", { name: "Traces 11", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await page.getByRole("tab", { name: "Traces", exact: true }).count(),
      1,
      "Pinned tab remains intact",
    );
  }
  const point = await load();
  await page.mouse.click(point.x, point.y);
  const track = page.locator(".even-workbench-tab-track");
  await track.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .filter((a) => a.id === "even-tab-remove-gap")
      .forEach((a) => {
        a.pause();
        a.currentTime = 40;
      }),
  );
  const other = page.getByRole("tab", { name: "Traces 12", exact: true });
  const box = await other.boundingBox();
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  assert.equal(
    await page.getByRole("tab").count(),
    14,
    "Clicking another tab label during removal never forwards a close",
  );
  assert.equal(
    await other.getAttribute("aria-selected"),
    "true",
    "Other tab selection retains its normal behavior",
  );
  console.log(
    `Verified ${theme} stationary X clicks at 60/100/250/350ms intervals: each click closes one intended tab, no hold restart or pinned-tab removal, and clicks elsewhere keep normal selection.`,
  );
}

export async function checkRapidRemovalCue(page, base, theme) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--immediate-creation&viewMode=story&globals=theme:${theme}`,
  );
  const add = page.getByRole("button", { name: "New trace tab", exact: true });
  await add.waitFor();
  for (let i = 0; i < 12; i++) {
    await add.focus();
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
  );
  const close = await page
    .locator(".even-workbench-tab-close[data-active-tab]")
    .boundingBox();
  const point = { x: close.x + close.width / 2, y: close.y + close.height / 2 };
  const track = page.locator(".even-workbench-tab-track");
  const pose = async (time) =>
    track.evaluate(async (node, time) => {
      const animations = node
        .getAnimations({ subtree: true })
        .filter((a) => a.id === "even-tab-remove-gap");
      animations.forEach((a) => {
        a.pause();
        a.currentTime = time;
      });
      await new Promise(requestAnimationFrame);
      const row = node
        .querySelector(".even-tab[data-active]")
        .closest(".even-workbench-tab");
      const box = row.getBoundingClientRect(),
        matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform);
      return {
        left: box.left,
        finalLeft: box.left - matrix.m41,
        width: box.width,
        scale: matrix.a,
        opacity: getComputedStyle(row).opacity,
        durations: animations.map((a) => a.effect.getTiming().duration),
        gap: animations[0]?.effect.getKeyframes()[1].offset,
      };
    }, time);
  await page.mouse.click(point.x, point.y);
  await pose(40);
  const before = await page
    .getByRole("tab", { name: "Traces 13", exact: true })
    .evaluate(
      (node) =>
        node.closest(".even-workbench-tab").getBoundingClientRect().left,
    );
  await page.mouse.click(point.x, point.y);
  const start = await pose(0);
  assert.ok(
    Math.abs(start.left - before) < 1,
    "Stationary repeat input preserves the painted pose instead of snapping before removal",
  );
  assert.ok(
    start.durations.length > 0 &&
      start.durations.every((duration) => duration === 100),
    "Only the latest short removal slide is active",
  );
  assert.equal(start.gap, 0);
  assert.equal(
    start.opacity,
    "1",
    "The surviving tab does not blink in with opacity changes",
  );
  assert.equal(start.scale, 1);
  assert.ok(
    start.finalLeft - start.left > 10,
    "The repeat has a real spatial displacement",
  );
  await page.screenshot({
    path: `/tmp/even-rapid-removal-cue-start-${theme}.png`,
  });
  const middle = await pose(35);
  assert.ok(
    middle.left > start.left + 5 && middle.left < start.finalLeft - 1,
    "A repeat shows a measurable in-between position rather than swapping labels at the final position",
  );
  assert.equal(middle.opacity, "1");
  await page.screenshot({
    path: `/tmp/even-rapid-removal-cue-moving-${theme}.png`,
  });
  const beforeNext = await page
    .getByRole("tab", { name: "Traces 12", exact: true })
    .evaluate(
      (node) =>
        node.closest(".even-workbench-tab").getBoundingClientRect().left,
    );
  await page.mouse.click(point.x, point.y);
  const redirected = await pose(0);
  assert.ok(
    Math.abs(redirected.left - beforeNext) < 1,
    "Another rapid close redirects continuous movement from the visible position",
  );
  assert.equal(
    await page.getByRole("tab").count(),
    12,
    "Three stationary clicks close exactly three tabs",
  );
  await track.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .filter((a) => a.id === "even-tab-remove-gap")
      .forEach((a) => a.finish()),
  );
  await page.waitForFunction(
    () => !document.querySelector(".even-workbench-tab-track[data-removing]"),
  );
  assert.equal(
    await track.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((a) => a.id === "even-tab-remove-gap").length,
    ),
    0,
    "No stale slide remains queued after settling",
  );
  console.log(
    `Verified ${theme} continuous 100ms repeat removal: fixed-pointer clicks retain the painted pose, visibly slide through intermediate positions without blinking/scaling, and replace rather than queue motion.`,
  );
}
