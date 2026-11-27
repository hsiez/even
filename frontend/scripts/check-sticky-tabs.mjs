import assert from "node:assert/strict";

export async function checkStickyTabs(page, base, theme, axe) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
  );
  const scroll = page.locator(".even-workbench-tab-scroll");
  const selected = page.getByRole("tab", { selected: true });
  await page.getByRole("tab", { name: "Traces 5", exact: true }).click();
  async function settle(edge) {
    await page.waitForFunction((edge) => {
      const track = document.querySelector(".even-workbench-tab-track");
      const active = track.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const indicator = track.querySelector(".even-workbench-tab-indicator");
      return (
        active &&
        track.dataset.stickyEdge === edge &&
        Math.abs(
          active.getBoundingClientRect().left -
            indicator.getBoundingClientRect().left,
        ) < 0.5
      );
    }, edge);
  }
  const move = async (left, edge) => {
    await scroll.evaluate((node, left) => {
      node.scrollLeft = left;
    }, left);
    await settle(edge);
  };
  async function closeClearance(edge) {
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
    const close = page.locator(".even-workbench-tab-close[data-active-tab]");
    await close.hover();
    await page.waitForFunction(
      () =>
        !document.querySelector(".even-workbench-tab-track[data-scrolling]"),
    );
    const gaps = await close.evaluate((node) => {
      const track = node.closest(".even-workbench-tab-track");
      const row = track.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const outer = row.getBoundingClientRect();
      const target = node.getBoundingClientRect();
      const highlight = getComputedStyle(node, "::before");
      const x = target.left + parseFloat(highlight.left);
      const y = target.top + parseFloat(highlight.top);
      return {
        edge: track.dataset.stickyEdge,
        top: y - outer.top,
        right: outer.right - x - parseFloat(highlight.width),
        bottom: outer.bottom - y - parseFloat(highlight.height),
      };
    });
    assert.equal(
      gaps.edge,
      edge,
      "Close spacing is checked while genuinely pinned",
    );
    assert.ok(
      Math.abs(gaps.top - gaps.right) < 0.5 &&
        Math.abs(gaps.top - gaps.bottom) < 0.5,
      `Pinned close highlight keeps matching top/right/bottom clearance: ${JSON.stringify(gaps)}`,
    );
  }
  const geometry = () =>
    selected.evaluate((node) => {
      const row = node.closest(".even-workbench-tab");
      const track = row.closest(".even-workbench-tab-track");
      const view = track.parentElement.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      const close = track.querySelector("[data-active-tab]");
      const c = close?.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        width: box.width,
        inside: box.left >= view.left && box.right <= view.right,
        closeInside: !c || (c.left >= box.left && c.right <= box.right),
        activeOnTop: row.contains(
          document.elementFromPoint(box.left + 18, box.top + box.height / 2),
        ),
        closeOnTop:
          !c ||
          close.contains(
            document.elementFromPoint(
              c.left + c.width / 2,
              c.top + c.height / 2,
            ),
          ),
      };
    });
  await settle("");
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".even-workbench-tab-track")
        .hasAttribute("data-indicator-moving"),
  );
  const scrollFrames = await scroll.evaluate((node) => {
    const frames = [];
    for (const x of [700, 1400, 4000, 0, 520, 6200]) {
      node.scrollLeft = x;

      const row = node.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const box = row.getBoundingClientRect();
      const close = node.querySelector("[data-active-tab]");
      const c = close.getBoundingClientRect();
      const margin = parseFloat(getComputedStyle(close).marginInlineEnd);
      frames.push({
        width: box.width,
        border: getComputedStyle(row).borderTopColor,
        shoulder: getComputedStyle(row, "::before").visibility,
        separate: getComputedStyle(
          node.querySelector(".even-workbench-tab-indicator"),
        ).visibility,
        closeOffset: Math.abs(c.right + margin - box.right),
      });
    }
    return frames;
  });
  assert.ok(
    scrollFrames.every(
      (frame) =>
        frame.width === scrollFrames[0].width &&
        frame.border !== "rgba(0, 0, 0, 0)" &&
        frame.shoulder === "visible" &&
        frame.separate === "hidden" &&
        frame.closeOffset < 0.5,
    ),
    "Scroll frames use one native fixed-width outline and close target before React updates",
  );

  const fadeFrames = await scroll.evaluate((node) => {
    node.dispatchEvent(new WheelEvent("wheel", { deltaX: 1 }));
    const row = node.querySelector(
      ".even-workbench-tab:has(.even-tab[data-active])",
    );
    const start = row.querySelector(".even-workbench-active-fade-start");
    const end = row.querySelector(".even-workbench-active-fade-end");
    const frames = [];
    const range = node.scrollWidth - node.clientWidth;
    for (const x of [0, 500, 620, 4000, range, 0]) {
      node.scrollLeft = x;

      for (const shift of [-12.5, 8.25, 0]) {
        row.style.transform = `translateX(${shift}px)`;
        const box = row.getBoundingClientRect();
        const left = start.getBoundingClientRect();
        const right = end.getBoundingClientRect();
        const stroke = parseFloat(getComputedStyle(row).borderLeftWidth);
        frames.push({
          left: Math.abs(left.left - box.left),
          right: Math.abs(right.left - box.right),
          top: Math.abs(left.top - box.top),
          bottom: Math.abs(right.bottom - box.bottom + stroke),
          visible: getComputedStyle(start).opacity === "1",
          range: node.scrollWidth - node.clientWidth,
        });
      }
    }
    row.style.removeProperty("transform");
    return { frames, range };
  });
  assert.ok(
    fadeFrames.frames.every(
      (frame) =>
        frame.left < 0.5 &&
        frame.right < 0.5 &&
        frame.top < 0.5 &&
        frame.bottom < 0.5 &&
        frame.visible &&
        frame.range === fadeFrames.range,
    ),
    "Fades stay attached through rapid reversals and fractional edge feedback without extra scroll range",
  );
  await move(1000, "start");
  const first = await geometry();
  await move(6000, "start");
  const second = await geometry();
  assert.equal(await selected.textContent(), "Traces 5");
  assert.ok(
    Math.abs(first.left - second.left) < 0.5 && first.width === second.width,
    "Active tab stops at the left boundary without stretching",
  );
  assert.ok(
    second.inside &&
      second.closeInside &&
      second.activeOnTop &&
      second.closeOnTop,
    "Active label and close target remain visible above passing controls",
  );
  await closeClearance("start");
  await page.screenshot({ path: `/tmp/even-sticky-left-${theme}.png` });

  await move(1000, "start");
  const underlay = await page.addStyleTag({
    content:
      ".even-workbench-tab:not(:has(.even-tab[data-active])) { background: rgb(255, 0, 255); }",
  });
  const samples = await selected.evaluate((node) => {
    const row = node.closest(".even-workbench-tab");
    const box = row.getBoundingClientRect();
    const bar = row.closest(".even-workbench-tab-bar").getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(row).borderTopLeftRadius);
    const fade = parseFloat(
      getComputedStyle(row.closest(".even-workbench-tab-track"), "::before")
        .width,
    );
    return [
      [bar.left + 2, bar.top + 2],
      [box.left - radius + 3, box.bottom - radius + 1],
      [box.right + radius - 3, box.bottom - radius + 1],
      [box.left - radius / 2, box.top + box.height / 2],
      [box.right + radius / 2, box.top + box.height / 2],
      [box.right + radius - 1 + fade / 2, box.top + box.height / 2],
      [box.left + box.width / 2, box.top],
      [box.left, box.top + radius + 2],
      [box.right - 1, box.top + radius + 2],
    ];
  });
  const screenshot = await page.screenshot({ scale: "css" });
  const colors = await page.evaluate(
    async ({ dataUrl, samples }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return samples.map(([x, y]) => [
        ...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data,
      ]);
    },
    {
      dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
      samples,
    },
  );
  assert.deepEqual(
    colors[1],
    colors[0],
    "Left shoulder gap hides passing content",
  );
  assert.deepEqual(
    colors[2],
    colors[0],
    "Right shoulder gap hides passing content",
  );
  assert.deepEqual(
    colors[3],
    colors[0],
    "Left backdrop continues to the tab wall without a gap",
  );
  assert.deepEqual(
    colors[4],
    colors[0],
    "Right backdrop continues to the tab wall without a gap",
  );
  assert.notDeepEqual(
    colors[5],
    colors[0],
    "Passing content is partly visible within the fade",
  );
  assert.notDeepEqual(
    colors[5],
    [255, 0, 255, 255],
    "Passing content fades before reaching the curve",
  );
  assert.deepEqual(
    colors[7],
    colors[6],
    "Attached left fade leaves the active tab's vertical border intact",
  );
  assert.deepEqual(
    colors[8],
    colors[6],
    "Attached right fade leaves the active tab's vertical border intact",
  );
  await underlay.evaluate((node) => node.remove());

  await move(0, "");
  assert.ok(
    (await geometry()).left > first.left + 100,
    "Tab returns to its normal slot when scrolling back",
  );
  await selected.press("End");
  const range = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  );
  await move(0, "end");
  assert.equal(
    await scroll.evaluate((node) => node.scrollWidth - node.clientWidth),
    range,
    "Sticky backdrops do not add artificial scroll range",
  );
  const right = await geometry();
  await move(100, "end");
  const rightAgain = await geometry();
  assert.ok(
    Math.abs(right.right - rightAgain.right) < 0.5 &&
      right.width === rightAgain.width,
    "Active tab stops at the right boundary without stretching",
  );
  assert.ok(
    rightAgain.inside &&
      rightAgain.closeInside &&
      rightAgain.activeOnTop &&
      rightAgain.closeOnTop,
  );
  await closeClearance("end");
  await page.screenshot({ path: `/tmp/even-sticky-right-${theme}.png` });

  await page.setViewportSize({ width: 390, height: 700 });
  await move(0, "end");
  await selected.focus();
  await selected.press("Tab");
  await page.waitForFunction(() => {
    const focus = document.activeElement;
    const box = focus.getBoundingClientRect();
    return (
      focus.classList.contains("even-workbench-tab-close") &&
      focus.contains(
        document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        ),
      )
    );
  });
  assert.ok(
    await page.evaluate(() => {
      const target = document.activeElement.getBoundingClientRect();
      const row = document.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const extent =
        parseFloat(getComputedStyle(row).borderTopLeftRadius) +
        parseFloat(
          getComputedStyle(row.closest(".even-workbench-tab-track"), "::before")
            .width,
        );
      return target.right <= row.getBoundingClientRect().left - extent;
    }),
    "Keyboard focus clears the pinned tab's curve and fade, not just its body",
  );
  assert.equal(
    await selected.getAttribute("aria-selected"),
    "true",
    "Revealing an obscured close target does not change selection",
  );
  await page.screenshot({ path: `/tmp/even-sticky-mobile-${theme}.png` });

  await page.setViewportSize({ width: 1000, height: 600 });
  await move(0, "end");
  await page.getByRole("tab", { name: "Traces 2", exact: true }).click();
  await move(6000, "start");
  await selected.hover();
  await page
    .getByRole("button", { name: "Close Traces 2", exact: true })
    .click();
  assert.equal(await page.getByRole("tab").count(), 59);
  assert.equal(await selected.textContent(), "Traces 3");
  await selected.press("End");
  assert.match(await selected.textContent(), /^Traces 60/);
  await selected.press("Home");
  assert.equal(await selected.textContent(), "Traces");
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
  await checkScrollHover(page, base, theme);
  await checkGestureContainment(page);
  console.log(
    `Verified ${theme} sticky active tab at both boundaries, fixed width, shoulder occlusion, fade, close hit targets, keyboard visibility and wheel gesture containment.`,
  );
}

async function checkGestureContainment(page) {
  const scroll = page.locator(".even-workbench-tab-scroll");
  await page.locator(".even-tabs-design-frame").evaluate((frame) => {
    const host = document.createElement("div");
    host.id = "gesture-scroll-host";
    host.style.cssText = "width:720px;height:240px;overflow:auto";
    frame.before(host);
    host.append(frame);
    frame.style.width = "1000px";
    frame.style.maxWidth = "none";
    const spacer = document.createElement("div");
    spacer.style.cssText = "width:1800px;height:1200px";
    spacer.setAttribute("aria-hidden", "true");
    host.append(spacer);
    host.scrollLeft = 100;
    host.scrollTop = 8;
  });
  const frames = () =>
    page.evaluate(async () => {
      for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    });
  await frames();
  const box = await scroll.boundingBox();
  const host = page.locator("#gesture-scroll-host");
  const hostBox = await host.boundingBox();
  await page.mouse.move(hostBox.x + hostBox.width / 2, box.y + box.height / 2);
  const before = await host.evaluate((node) => [
    node.scrollLeft,
    node.scrollTop,
  ]);
  const vertical = await scroll.evaluate((node) => node.scrollTop);
  async function gesture(dx, dy) {
    await page.mouse.wheel(dx, dy);
    await frames();
    assert.deepEqual(
      await host.evaluate((node) => [node.scrollLeft, node.scrollTop]),
      before,
      "Tab gestures do not chain into a scrollable ancestor at either boundary",
    );
    assert.equal(
      await scroll.evaluate((node) => node.scrollTop),
      vertical,
      "Tab gestures leave the vertical position unchanged",
    );
  }
  await gesture(0, 120);
  await scroll.evaluate((node) => (node.scrollLeft = 0));
  await frames();
  await gesture(-500, -120);
  await gesture(300, 0);
  assert.ok(
    await scroll.evaluate((node) => node.scrollLeft > 0),
    "Horizontal wheel scrolling still moves the tab strip",
  );
  await scroll.evaluate((node) => (node.scrollLeft = node.scrollWidth));
  await frames();
  await gesture(500, 120);
}

async function checkScrollHover(page, base, theme) {
  await page.goto(
    `${base}/iframe.html?id=workbench-workbenchtabs--overflow&viewMode=story&globals=theme:${theme}`,
  );
  const track = page.locator(".even-workbench-tab-track");
  const idle = () =>
    page.waitForFunction(
      () =>
        !document
          .querySelector(".even-workbench-tab-track")
          ?.hasAttribute("data-scrolling"),
    );
  await page.getByRole("tab", { name: "Traces 2", exact: true }).waitFor();
  await idle();
  const neutral = await page
    .getByRole("tab", { name: "Traces 5", exact: true })
    .evaluate((node) => ({
      text: getComputedStyle(node).color,
      surface: getComputedStyle(node.parentElement, "::before").backgroundColor,
    }));
  await page.getByRole("tab", { name: "Traces 2", exact: true }).hover();
  const hover = () =>
    track.evaluate((node) => {
      const row = node.querySelector(
        ".even-workbench-tab[data-hovered]:not(:has(.even-tab[data-active]))",
      );
      const close =
        row &&
        node.querySelector(
          `.even-workbench-tab-close[data-tab-column="${row.dataset.tabColumn}"]`,
        );
      return (
        row && {
          surface: getComputedStyle(row, "::before").backgroundColor,
          close: getComputedStyle(close).opacity,
        }
      );
    });
  assert.notEqual((await hover()).surface, neutral.surface);
  assert.equal((await hover()).close, "1");
  await page.mouse.wheel(180, 0);
  await page.waitForFunction(() =>
    document
      .querySelector(".even-workbench-tab-track")
      .hasAttribute("data-scrolling"),
  );
  const moving = await track.evaluate((node) => ({
    rows: [
      ...node.querySelectorAll(
        ".even-workbench-tab:not(:has(.even-tab[data-active]))",
      ),
    ].map((row) => ({
      surface: getComputedStyle(row, "::before").backgroundColor,
      text: getComputedStyle(row.querySelector(".even-tab")).color,
    })),
    closes: [
      ...node.querySelectorAll(".even-workbench-tab-close:not(:focus-visible)"),
    ].map((close) => getComputedStyle(close).opacity),
    dividers: [
      ...node.querySelectorAll(
        ".even-workbench-tab:not(:has(.even-tab[data-active])) + .even-workbench-tab:not(:has(.even-tab[data-active]))",
      ),
    ].map((row) => getComputedStyle(row, "::after").opacity),
  }));
  assert.ok(
    moving.rows.every(
      (row) => row.surface === neutral.surface && row.text === neutral.text,
    ),
    "Passing tabs keep their resting surface and text during scrolling",
  );
  assert.ok(
    moving.closes.every((opacity) => opacity === "0"),
    "Pointer hover does not flash close buttons during scrolling",
  );
  assert.ok(
    moving.dividers.every((opacity) => opacity === "1"),
    "Inactive dividers stay stable while tabs pass the pointer",
  );
  await idle();
  assert.notEqual(
    (await hover()).surface,
    neutral.surface,
    "Hover restores after scrolling stops without moving the pointer",
  );
  assert.equal((await hover()).close, "1");
  const tails = await track.evaluate(async (node) => {
    const viewport = node.parentElement;
    const results = [];
    for (const direction of [-1, 1]) {
      viewport.scrollLeft = direction < 0 ? 0 : viewport.scrollWidth;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const start = performance.now();
      let restored;
      let rearmed = false;
      const observer = new MutationObserver(() => {
        const moving = node.hasAttribute("data-scrolling");
        if (!moving && restored === undefined)
          restored = performance.now() - start;
        if (moving && restored !== undefined) rearmed = true;
      });
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["data-scrolling"],
      });
      const offset = viewport.scrollLeft;
      for (let i = 0; i < 16; i++) {
        viewport.dispatchEvent(new WheelEvent("wheel", { deltaX: direction }));
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      observer.disconnect();
      results.push({
        restored,
        rearmed,
        stationary: offset === viewport.scrollLeft,
        moving: node.hasAttribute("data-scrolling"),
      });
    }
    return results;
  });
  assert.ok(
    tails.every(
      (tail) =>
        tail.stationary && tail.restored < 300 && !tail.rearmed && !tail.moving,
    ),
    `Trailing wheel input at either boundary does not delay hover recovery: ${JSON.stringify(tails)}`,
  );
  const selected = page.getByRole("tab", { selected: true });
  await selected.focus();
  await selected.press("Tab");
  await page.mouse.wheel(80, 0);
  await page.waitForFunction(() =>
    document
      .querySelector(".even-workbench-tab-track")
      .hasAttribute("data-scrolling"),
  );
  const focus = await page
    .locator(".even-workbench-tab-close:focus-visible")
    .evaluate((node) => ({
      opacity: getComputedStyle(node).opacity,
      outline: parseFloat(getComputedStyle(node).outlineWidth),
    }));
  assert.ok(
    focus.opacity === "1" && focus.outline > 0,
    "Keyboard-focused close controls retain their focus indicator during scrolling",
  );
}
