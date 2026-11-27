import assert from "node:assert/strict";

export async function checkMotionTokens(page, base, theme) {
  const tabsUrl = `${base}/iframe.html?id=workbench-workbenchtabs--design-sandbox&viewMode=story&globals=theme:${theme}`;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(tabsUrl);
  const track = page.locator(".even-workbench-tab-track");
  await track.evaluate((node) => {
    node.style.setProperty("--even-motion-duration-enter", "0.32s");
    node.style.setProperty("--even-motion-duration-move", "110ms");
    node.style.setProperty("--even-motion-easing-enter", "linear");
    node.style.setProperty("--even-motion-easing-move", "linear");
  });
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .click();
  await page.waitForFunction(() => document.querySelector("[data-creating]"));
  const timing = await track.evaluate((node) => {
    const animations = node.getAnimations({ subtree: true });
    const enter = animations.find(
      (animation) => animation.id === "even-tab-enter",
    );
    const focus = animations.find(
      (animation) => animation.id === "even-tab-create-focus",
    );
    const result = {
      enter: enter.effect.getTiming().duration,
      easing: enter.effect.getTiming().easing,
      focus: focus.effect.getTiming().duration,
      css: getComputedStyle(node.querySelector(".even-workbench-tab-indicator"))
        .getPropertyValue("--even-motion-duration-move")
        .trim(),
    };
    animations.forEach((animation) => animation.finish());
    return result;
  });
  assert.deepEqual(timing, {
    enter: 320,
    easing: "linear",
    focus: 430,
    css: "110ms",
  });

  await track.evaluate((node) => {
    node.style.setProperty("--even-motion-duration-enter", "0s");
    node.style.setProperty("--even-motion-duration-move", "0s");
  });
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .click();
  await page.getByRole("tab", { name: "Traces 5", exact: true }).waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(await track.getAttribute("data-creating"), null);
  assert.equal(
    await track.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((a) => a.id.startsWith("even-tab-")).length,
    ),
    0,
  );

  await page.goto(tabsUrl);
  await page.getByRole("tab", { name: "Tool errors", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Playground 1", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await track
      .locator(".even-workbench-tab-indicator")
      .evaluate((node) => getComputedStyle(node).transitionDuration),
    "0s",
  );

  await page.getByRole("button", { name: "New tab", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem", { name: "New trace explorer", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Traces 4", exact: true }).waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(await track.getAttribute("data-creating"), null);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    `${base}/iframe.html?id=foundations-motion--decisions&viewMode=story&globals=theme:${theme}`,
  );
  await page
    .getByRole("button", { name: "Preview enter", exact: true })
    .click();
  const reduced = await page
    .locator('[data-purpose="enter"]')
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        transform: style.transform,
        properties: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });
  assert.deepEqual(reduced, {
    transform: "none",
    properties: "opacity",
    duration: "0.1s",
  });
  await page.screenshot({ path: `/tmp/even-motion-reduced-${theme}.png` });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=foundations-motion--large-areas&viewMode=story&globals=theme:${theme}`,
  );
  const large = page.locator('[data-large] [data-purpose="enter"]');
  const largeTiming = await large.evaluate((node) => ({
    width: node.getBoundingClientRect().width,
    durations: getComputedStyle(node).transitionDuration,
    easing: getComputedStyle(node).transitionTimingFunction,
  }));
  assert.ok(
    largeTiming.width > 200,
    "Large-motion preview uses a broad surface",
  );
  assert.equal(largeTiming.durations, "0.35s, 0.35s");
  assert.equal(
    largeTiming.easing,
    "cubic-bezier(0.19, 1, 0.22, 1), cubic-bezier(0.19, 1, 0.22, 1)",
  );
  await page
    .getByRole("button", { name: "Preview enter-large", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.deepEqual(
    await large.evaluate((node) => ({
      transform: getComputedStyle(node).transform,
      properties: getComputedStyle(node).transitionProperty,
    })),
    { transform: "none", properties: "opacity" },
  );
  await page.screenshot({ path: `/tmp/even-motion-large-${theme}.png` });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log(
    `Verified ${theme} shared CSS/WAAPI motion overrides, zero durations, keyboard navigation/creation and reduced-motion preview.`,
  );
}
