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
