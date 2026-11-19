import assert from "node:assert/strict";

export async function checkHomePage(page, base, theme, axe) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(
    `${base}/iframe.html?id=pages-homepage--staging&viewMode=story&globals=theme:${theme}`,
  );
  await page.getByRole("heading", { name: "Traces", exact: true }).waitFor();
  const resultCount = page.locator(".even-home-results-status");
  assert.match(await resultCount.innerText(), /12 traces/);
  await page.getByRole("button", { name: "Generate sample trace" }).click();
  assert.match(await resultCount.innerText(), /13 traces/);
  assert.equal(
    await page.locator(".even-trace-operation-action").count(),
    13,
    "Generating a sample adds one row",
  );

  const search = page.getByRole("combobox", { name: "Search traces" });
  const beforeFocus = await search.boundingBox();
  const restingBorder = await search.evaluate(
    (node) => getComputedStyle(node).borderTopColor,
  );
  await search.focus();
  await page.keyboard.press("ArrowRight");
  const focusedStyle = await search.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      border: style.borderTopColor,
      shadow: style.boxShadow,
      outline: style.outlineStyle,
    };
  });
  assert.notEqual(
    focusedStyle.border,
    restingBorder,
    "Search focus changes the border color",
  );
  assert.ok(focusedStyle.shadow.includes("inset"), "Search focus draws inward");
  assert.equal(focusedStyle.outline, "none", "Search has no outer focus ring");
  assert.deepEqual(
    await search.boundingBox(),
    beforeFocus,
    "Search focus does not alter layout geometry",
  );
  // Decisions remain independently adjustable without changing focus geometry.
  await search.evaluate((node) => {
    node.style.setProperty("--even-size-border-control", "2px");
    node.style.setProperty("--even-size-focus-inset", "3px");
    node.style.setProperty("--even-size-focus-outline", "4px");
  });
  const customized = await search.evaluate((node) => {
    const style = getComputedStyle(node);
    return { border: style.borderTopWidth, shadow: style.boxShadow };
  });
  assert.equal(customized.border, "2px");
  assert.ok(
    customized.shadow.includes("3px"),
    "Inset focus consumes its decision",
  );
  await page.emulateMedia({ forcedColors: "active" });
  const highContrast = await search.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      width: style.outlineWidth,
      offset: style.outlineOffset,
      shadow: style.boxShadow,
    };
  });
  assert.deepEqual(highContrast, {
    width: "4px",
    offset: "-4px",
    shadow: "none",
  });
  await page.emulateMedia({ forcedColors: "none" });
  await search.evaluate((node) => {
    for (const name of [
      "--even-size-border-control",
      "--even-size-focus-inset",
      "--even-size-focus-outline",
    ])
      node.style.removeProperty(name);
  });
  await search.fill("rollback");
  await search.press("Escape");
  assert.match(await resultCount.innerText(), /1 trace/);
  const operation = page.getByRole("button", {
    name: /Verify the rollback configuration/,
  });
  await operation.focus();
  await page.keyboard.press("Enter");
  const inspector = page.getByRole("complementary", {
    name: "Execution inspector",
  });
  await inspector.waitFor();
  assert.equal(
    await inspector.evaluate((node) => node === document.activeElement),
    true,
    "Inspector receives focus on opening",
  );
  await inspector.getByRole("treeitem", { name: "Read configuration" }).click();
  await inspector
    .getByRole("region", { name: "Span details" })
    .getByText("tool.name", { exact: true })
    .waitFor();
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document.body, {
        rules: { region: { enabled: false } },
      })
    ).violations.map((item) => ({
      id: item.id,
      elements: item.nodes.map((node) => node.html),
    })),
  );
  assert.deepEqual(
    violations,
    [],
    `${theme}: open home-page inspector accessibility`,
  );
  await inspector.getByRole("button", { name: "Close inspector" }).click();
  assert.equal(
    await operation.evaluate((node) => node === document.activeElement),
    true,
    "Closing returns focus to the selected execution",
  );

  await search.clear();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  assert.match(await resultCount.innerText(), /4 traces · Research/);
  await search.fill("has:error");
  await search.press("Enter");
  await page
    .getByText("No traces match these filters.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Reset view" }).click();
  assert.match(await resultCount.innerText(), /4 traces · Research/);
  await page.getByRole("button", { name: "All agents", exact: true }).click();
  assert.match(await resultCount.innerText(), /13 traces · All agents/);

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

  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${theme}, ${width}px: page contains horizontal overflow`,
    );
    await page
      .getByRole("button", { name: /Verify the rollback configuration/ })
      .click();
    await inspector.waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${theme}, ${width}px: open inspector fits`,
    );
    await inspector.getByRole("button", { name: "Close inspector" }).click();
  }

  await page.goto(
    `${base}/iframe.html?id=pages-homepage--error&viewMode=story&globals=theme:${theme}`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("table", { name: "Recorded traces" }).waitFor();
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "Staging error example recovers through retry",
  );
  await checkSearchPrototype(page, base, theme, axe);
  await checkAgentSpaces(page, base, theme, axe);
  await checkManyAgents(page, base, theme, axe);
  await checkHomeControls(page, base, theme);
}

export async function checkHomeControls(page, base, theme) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(
      `${base}/iframe.html?id=pages-homepage--agent-spaces&viewMode=story&globals=theme:${theme}`,
    );
    const selector = page.getByRole("radiogroup", { name: "Color theme" });
    await selector.waitFor();
    const bounds = await selector.evaluate((node) => {
      const sidebar = node.closest("nav");
      const box = node.getBoundingClientRect();
      const owner = sidebar.getBoundingClientRect();
      const style = getComputedStyle(sidebar);
      return {
        left: box.left - owner.left,
        bottom: owner.bottom - box.bottom - parseFloat(style.borderBottomWidth),
        insetLeft: parseFloat(style.paddingLeft),
        insetBottom: parseFloat(style.paddingBottom),
      };
    });
    assert.ok(
      Math.abs(bounds.left - bounds.insetLeft) < 1,
      "Theme selector aligns with the sidebar's left inset",
    );
    assert.ok(
      Math.abs(bounds.bottom - bounds.insetBottom) < 1,
      "Theme selector stays at the sidebar's lower edge",
    );
    assert.equal(
      await page.getByRole("button", { name: /Use .* theme/ }).count(),
      0,
    );
    assert.equal(await selector.locator("svg.lucide-sun-medium").count(), 1);
    assert.equal(await selector.locator("svg.lucide-moon").count(), 1);
    const input = page.getByRole("combobox", { name: "Search traces" });
    const icon = page.locator(".even-trace-search-icon");
    const geometry = await icon.evaluate((node) => {
      const input = node.parentElement.querySelector("input");
      const iconBox = node.getBoundingClientRect();
      const field = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      return {
        gap:
          field.left +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.paddingLeft) -
          iconBox.right,
        centers: iconBox.y + iconBox.height / 2 - (field.y + field.height / 2),
        hidden: node.getAttribute("aria-hidden"),
      };
    });
    assert.ok(
      geometry.gap > 0 && Math.abs(geometry.centers) < 1,
      "Search icon leaves space before the input text and stays vertically centered",
    );
    assert.equal(geometry.hidden, "true");
    const box = await icon.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(
      await input.evaluate((node) => node === document.activeElement),
      true,
      "Clicking through the decorative search icon focuses the input",
    );
    await input.fill("tool:read_logs");
    await page.keyboard.press("Escape");
    for (const next of ["light", "dark", theme]) {
      const radio = page.getByRole("radio", {
        name: next === "light" ? "Light theme" : "Dark theme",
        exact: true,
      });
      await radio.click();
      await page.waitForFunction(
        (next) => document.documentElement.dataset.evenTheme === next,
        next,
      );
      assert.equal(await radio.getAttribute("aria-checked"), "true");
      assert.equal(
        await input.inputValue(),
        "tool:read_logs",
        "Theme changes retain the current query",
      );
    }
    await input.click();
    const popup = page.locator(".even-trace-search-popup");
    await popup.waitFor();
    assert.equal(
      await popup.evaluate((node) => {
        const probe = document.createElement("span");
        probe.style.background = "var(--even-surface-page)";
        document.body.append(probe);
        const matches =
          getComputedStyle(node).backgroundColor ===
          getComputedStyle(probe).backgroundColor;
        probe.remove();
        return matches;
      }),
      true,
      "Portalled suggestions inherit the chosen document theme",
    );
    await page.keyboard.press("Escape");
  }
  console.log(
    `Verified ${theme} sidebar theme controls, responsive placement, retained query, portal theme inheritance and search icon focus/spacing.`,
  );
}

async function checkAgentSpaces(page, base, theme, axe) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${base}/iframe.html?id=pages-homepage--agent-spaces&viewMode=story&globals=theme:${theme}`,
  );
  const tabs = page.getByRole("tablist", { name: "Support workbench tabs" });
  const add = async (name) => {
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
  };
  const search = page.getByRole("combobox", { name: "Search traces" });
  await search.fill("deployment");
  await search.press("Escape");
  await page
    .getByRole("button", { name: /Investigate deployment failure/ })
    .click();
  const inspector = page.getByRole("complementary", {
    name: "Execution inspector",
  });
  await inspector
    .getByRole("treeitem", { name: "Read deployment logs" })
    .click();
  await inspector.getByRole("tab", { name: "Summary" }).click();
  const resizer = page.getByRole("separator", {
    name: "Resize Operation column",
  });
  await resizer.focus();
  await resizer.press("Home");
  const tableScroll = page.getByRole("region", {
    name: "Recorded trace results",
  });
  await tableScroll.evaluate((node) => {
    node.scrollLeft = 100;
    node.dispatchEvent(new Event("scroll"));
  });
  const left = await tableScroll.evaluate((node) => node.scrollLeft);
  assert.ok(left > 0, "Fixture table can scroll horizontally");
  await add("New trace explorer");
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Traces 2",
  );
  assert.equal(await search.inputValue(), "");
  assert.equal(
    await inspector.count(),
    0,
    "Inactive explorer content unmounts",
  );
  await search.fill("has:error");
  await search.press("Escape");
  await add("New chat playground");
  assert.ok(await page.getByLabel("Message", { exact: true }).isDisabled());
  await page.getByRole("tab", { name: "Traces 2", exact: true }).click();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  assert.equal(
    await page.getByRole("tab", { name: "Traces 2", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Support", exact: true }).click();
  assert.equal(await search.inputValue(), "has:error");
  await page.screenshot({
    path: `/tmp/even-workbench-tabs-overview-${theme}.png`,
  });
  await page
    .getByRole("button", { name: "Close Traces 2", exact: true })
    .click();
  assert.ok(
    await page
      .getByRole("tab", { name: "Playground 1", exact: true })
      .evaluate((node) => node === document.activeElement),
  );
  await page
    .getByRole("button", { name: "Close Playground 1", exact: true })
    .click();
  assert.ok(
    await tabs
      .getByRole("tab", { name: "Traces", exact: true })
      .evaluate((node) => node === document.activeElement),
    "Restoring an inspector does not steal tab focus",
  );
  assert.equal(await search.inputValue(), "deployment");
  assert.equal(await resizer.getAttribute("aria-valuenow"), "128");
  assert.equal(await tableScroll.evaluate((node) => node.scrollLeft), left);
  assert.equal(
    await inspector
      .getByRole("tab", { name: "Summary" })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.evaluate(axe);
  assert.deepEqual(
    await page.evaluate(
      async () => (await window.axe.run(document)).violations,
    ),
    [],
  );
  await page.screenshot({ path: `/tmp/even-workbench-tabs-${theme}.png` });

  await page.setViewportSize({ width: 390, height: 900 });
  for (let n = 0; n < 8; n++) await add("New trace explorer");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Tab overflow stays inside the tab strip",
  );
  const selected = tabs.getByRole("tab", { selected: true });
  assert.ok(
    await selected.evaluate((node) => node === document.activeElement),
    "A new tab receives keyboard focus without waiting for its decoration",
  );
  await page.waitForFunction(
    (node) =>
      !node.closest(".even-workbench-tab-track").hasAttribute("data-creating"),
    await selected.elementHandle(),
  );
  assert.ok(
    await selected.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const list = node
        .closest(".even-workbench-tab-scroll")
        .getBoundingClientRect();
      return rect.left >= list.left && rect.right <= list.right;
    }),
    "Newly focused tabs are revealed in a narrow tab strip",
  );
  assert.ok(await page.getByRole("button", { name: "New tab" }).isVisible());
  await page.screenshot({
    path: `/tmp/even-workbench-tabs-narrow-${theme}.png`,
  });
  await selected.press("Home");
  assert.equal(
    await tabs
      .getByRole("tab", { name: "Traces", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
}

async function checkSearchPrototype(page, base, theme, axe) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `${base}/iframe.html?id=pages-homepage--search-prototype&viewMode=story&globals=theme:${theme}`,
  );
  const search = page.getByRole("combobox", { name: "Search traces" });
  await search.waitFor();
  const count = page.locator(".even-home-results-status");
  assert.match(await count.innerText(), /1 trace/);
  await search.fill("tool:read_logs has:error");
  await search.press("Escape");
  assert.match(await count.innerText(), /2 traces/);
  await page
    .getByRole("button", { name: /Validate release permissions/ })
    .waitFor();
  await search.fill('output:"ECONNRESET"');
  await search.press("Enter");
  assert.match(await count.innerText(), /2 traces/);
  const operation = page.getByRole("button", {
    name: /Check production deployment health/,
  });
  await operation.click();
  const inspector = page.getByRole("complementary", {
    name: "Execution inspector",
  });
  await inspector.waitFor();
  assert.equal(
    await inspector
      .getByRole("treeitem", { name: "Read deployment status", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await inspector
    .getByRole("region", { name: "Search match evidence" })
    .getByText("gen_ai.tool.call.result", { exact: true })
    .waitFor();
  await page.addScriptTag({ content: axe });
  assert.deepEqual(
    await page.evaluate(async () =>
      (
        await window.axe.run(document.body, {
          rules: { region: { enabled: false } },
        })
      ).violations.map((item) => ({
        id: item.id,
        elements: item.nodes.map((node) => node.html),
      })),
    ),
    [],
    `${theme}: matched span accessibility`,
  );
  await inspector.getByRole("button", { name: "Close inspector" }).click();
  assert.equal(
    await operation.evaluate((node) => node === document.activeElement),
    true,
  );
  await search.fill("tool:rea");
  await search.press("ArrowDown");
  await search.press("Enter");
  assert.equal(await search.inputValue(), "tool:read_logs");
  await search.fill('input:"deploy preview"');
  await search.press("Enter");
  assert.match(await count.innerText(), /1 trace/);
  await search.fill('context:"deploy preview"');
  await search.press("Enter");
  assert.match(await count.innerText(), /2 traces/);
  await search.fill("duration:soon");
  await search.press("Escape");
  assert.equal(await search.getAttribute("aria-invalid"), "true");
  await page
    .getByRole("alert")
    .getByText(/Use a duration/)
    .waitFor();
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await search.fill("tool:");
    await search.click();
    await page.getByRole("listbox", { name: "Search suggestions" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${theme}, ${width}px: search popup fits`,
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.addScriptTag({ content: axe });
    assert.deepEqual(
      await page.evaluate(async () =>
        (
          await window.axe.run(document.body, {
            // Base UI hides the outside accessibility tree while its typeable
            // combobox is open, then reveals it on Tab. Axe's static focus rule
            // flags those outside controls; verify that transition below.
            rules: {
              region: { enabled: false },
              "aria-hidden-focus": { enabled: false },
            },
          })
        ).violations.map((item) => ({
          id: item.id,
          elements: item.nodes.map((node) => node.html),
        })),
      ),
      [],
      `${theme}, ${width}px: open suggestions accessibility`,
    );
    for (let cycle = 0; cycle < 2; cycle++) {
      if (cycle) await search.click();
      await search.press("Tab");
      await page.getByRole("listbox").waitFor({ state: "hidden" });
      const nextControl = page.getByRole("button", { name: "Reset view" });
      assert.equal(
        await nextControl.evaluate(
          (node) =>
            node === document.activeElement &&
            !node.closest('[aria-hidden="true"]'),
        ),
        true,
        `${theme}, ${width}px: Tab dismisses suggestions and reveals the next control`,
      );
    }
  }
}

async function checkManyAgents(page, base, theme, axe) {
  for (const [width, height] of [
    [1000, 600],
    [1000, 360],
    [390, 700],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(
      `${base}/iframe.html?id=pages-homepage--many-agents&viewMode=story&globals=theme:${theme}`,
    );
    const list = page.getByRole("list", { name: "Agents", exact: true });
    const last = page.getByRole("button", {
      name: "Fixture agent 30",
      exact: true,
    });
    await last.waitFor({ state: "attached" });
    const box = await list.boundingBox();
    assert.ok(
      box.height > 0 && box.width > 0,
      "Agent list keeps a visible scroll viewport",
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(width < 768 ? 20000 : 0, width < 768 ? 0 : 2000);
    await page.waitForFunction(
      (last) => {
        const list = last.closest("ul").getBoundingClientRect();
        const box = last.getBoundingClientRect();
        return (
          box.top >= list.top &&
          box.bottom <= list.bottom &&
          box.left >= list.left &&
          box.right <= list.right
        );
      },
      await last.elementHandle(),
    );
    await last.click();
    assert.equal(
      await last.getAttribute("aria-pressed"),
      "true",
      "The last agent is reachable by pointer scrolling",
    );
    assert.equal(
      await page.locator(".even-home").evaluate((node) => node.scrollTop),
      0,
      "Agent scrolling leaves the workspace frame fixed",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Many agents do not widen the page",
    );
    if (width >= 768) {
      await page
        .getByRole("button", { name: "Fixture agent 1", exact: true })
        .focus();
      for (let i = 0; i < 29; i++) await page.keyboard.press("Tab");
      assert.ok(
        await last.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return (
            node === document.activeElement &&
            node.contains(
              document.elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2,
              ),
            )
          );
        }),
        "Keyboard focus reveals the last agent inside the agent scroller",
      );
    }
    await page.screenshot({
      path: `/tmp/even-many-agents-${theme}-${width}-${height}.png`,
    });
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
      "The bounded agent list remains accessible",
    );
  }
}
