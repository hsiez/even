import assert from "node:assert/strict";

// Exercise real Base UI mount/unmount transitions rather than restating CSS.
export async function checkOverlayMotion(page, base, theme) {
  const surfaces = [
    {
      story: "primitives-dialog--default",
      trigger: "Open settings",
      popup: ".even-dialog-popup",
      close: "Close settings",
      enter: 350,
      exit: 300,
    },
    {
      story: "primitives-popover--default",
      trigger: "Filter options",
      popup: ".even-popover-popup",
      close: "Apply filters",
      enter: 200,
      exit: 150,
    },
    {
      story: "primitives-menu--default",
      trigger: "Trace actions",
      popup: ".even-menu-popup",
      close: "Copy trace ID",
      enter: 200,
      exit: 150,
    },
  ];
  const pose = async (selector) =>
    page.locator(selector).evaluate(async (node) => {
      const animations = node.getAnimations();
      const timing = animations.map((animation) => {
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration / 2;
        return {
          duration: animation.effect.getTiming().duration,
          property: animation.transitionProperty,
          easing: animation.effect.getTiming().easing,
        };
      });
      await new Promise(requestAnimationFrame);
      const style = getComputedStyle(node);
      return {
        timing,
        opacity: Number(style.opacity),
        origin: style.transformOrigin,
        transform: style.transform,
      };
    });
  const waitForMotion = async (selector) =>
    page.waitForFunction(
      (selector) =>
        document.querySelector(selector)?.getAnimations().length > 0,
      selector,
    );
  const finish = async () =>
    page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish()),
    );

  await page.setViewportSize({ width: 1280, height: 800 });
  for (const surface of surfaces) {
    const url = `${base}/iframe.html?id=${surface.story}&viewMode=story&globals=theme:${theme}`;
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url);
    const trigger = page.getByRole("button", {
      name: surface.trigger,
      exact: true,
    });
    const popup = page.locator(surface.popup);
    await trigger.click();
    await waitForMotion(surface.popup);
    const entry = await pose(surface.popup);
    assert.ok(entry.timing.length >= 1);
    for (const motion of entry.timing) {
      assert.equal(motion.duration, surface.enter, `${surface.story} entry`);
      assert.ok(["opacity", "transform"].includes(motion.property));
    }
    assert.ok(
      entry.opacity > 0 && entry.opacity < 1,
      "Entry has an intermediate visible state",
    );
    if (surface.popup !== ".even-dialog-popup") {
      const origin = entry.origin.split(" ").map(parseFloat);
      assert.ok(origin[1] < 1, "Floating surface grows from its trigger edge");
    } else {
      const backdrop = await page
        .locator(".even-dialog-backdrop")
        .evaluate((node) =>
          node
            .getAnimations()
            .map((animation) => animation.effect.getTiming().duration),
        );
      assert.ok(
        backdrop.includes(surface.enter),
        "Backdrop and modal share large-area entry timing",
      );
    }
    await page.screenshot({
      path: `/tmp/even-overlay-motion-${surface.story}-${theme}.png`,
    });
    await finish();
    await page
      .getByRole(surface.popup === ".even-menu-popup" ? "menuitem" : "button", {
        name: surface.close,
        exact: true,
      })
      .click();
    await waitForMotion(surface.popup);
    const exit = await pose(surface.popup);
    assert.ok(
      exit.timing.every(
        (motion) => Math.abs(motion.duration - surface.exit) < 1,
      ),
      `${surface.story} uses its shorter exit decision`,
    );
    await finish();
    await popup.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (node) => node === document.activeElement,
      await trigger.elementHandle(),
    );

    // Keyboard opening and Escape must not wait for pointer decoration.
    await trigger.press("Enter");
    await popup.waitFor();
    assert.equal(
      await popup.evaluate((node) => getComputedStyle(node).transitionDuration),
      "0s",
    );
    assert.equal(
      await popup.evaluate((node) => node.getAnimations().length),
      0,
    );
    await page.keyboard.press("Escape");
    await popup.waitFor({ state: "hidden" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url);
    await trigger.click();
    await popup.waitFor();
    if (surface.popup === ".even-dialog-popup") {
      await waitForMotion(surface.popup);
      const reduced = await pose(surface.popup);
      assert.equal(reduced.transform, "none");
      assert.ok(
        reduced.timing.every(
          (motion) => motion.property === "opacity" && motion.duration === 100,
        ),
        "Reduced modal preserves only meaningful fading",
      );
    } else {
      assert.equal(
        await popup.evaluate((node) => node.getAnimations().length),
        0,
      );
      assert.equal(
        await popup.evaluate((node) => getComputedStyle(node).transform),
        "none",
      );
    }
    await finish();
  }

  // Reversing a menu mid-entry should retarget the current painted state,
  // and another opening must work before the previous exit completes.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=primitives-menu--default&viewMode=story&globals=theme:${theme}`,
  );
  const trigger = page.getByRole("button", {
    name: "Trace actions",
    exact: true,
  });
  await trigger.click();
  await waitForMotion(".even-menu-popup");
  await pose(".even-menu-popup");
  await trigger.click();
  await trigger.click();
  await page.getByRole("menu").waitFor();
  await finish();
  await page.getByRole("menuitem", { name: "Copy trace ID" }).click();
  await page.getByRole("menu").waitFor({ state: "hidden" });
  await page.getByRole("status").filter({ hasText: "copied" }).waitFor();
  console.log(
    `Verified ${theme} tokenized overlay entry/exit, trigger origins, modal backdrop, keyboard immediacy, reduced motion, rapid reversal and focus restoration.`,
  );
}
