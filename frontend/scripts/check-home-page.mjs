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
  assert.match(await resultCount.innerText(), /13 traces · All agents/);

  await page.getByRole("button", { name: "Duration", exact: true }).click();
  assert.match(
    await page.locator(".even-trace-table tbody tr").last().innerText(),
    /Unknown duration/,
  );
  await page.getByRole("button", { name: "Duration", exact: true }).click();
  assert.match(
    await page.locator(".even-trace-table tbody tr").last().innerText(),
    /Unknown duration/,
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
