import assert from "node:assert/strict";
import Color from "colorjs.io";

// Check the painted route against actual marker positions, not CSS constants or
// a second implementation of the curve formula. Observers may settle next frame.
async function checkRail(page) {
  await page.waitForFunction(() => {
    const paths = document.querySelectorAll(".even-trace-route");
    const dots = [...document.querySelectorAll(".even-trace-path-node")];
    if (paths.length !== 1 || !dots.length) return false;
    const path = paths[0];
    const d = path.getAttribute("d");
    if (!d) return false;
    const matrix = path.getScreenCTM();
    const length = path.getTotalLength();
    const route = [];
    // Move-only subpaths are valid when neighboring steps are collapsed.
    for (const match of d.matchAll(/M ([\d.-]+) ([\d.-]+)/g))
      route.push(
        new DOMPoint(Number(match[1]), Number(match[2])).matrixTransform(
          matrix,
        ),
      );
    for (let distance = 0; distance <= length; distance += 0.5) {
      route.push(path.getPointAtLength(distance).matrixTransform(matrix));
    }
    route.push(path.getPointAtLength(length).matrixTransform(matrix));
    return dots.every((dot, index) => {
      const box = dot.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const throughCenter = route.some(
        (point) => Math.hypot(point.x - x, point.y - y) < 1,
      );
      const previous = dots[index - 1]?.getBoundingClientRect();
      const indent = previous && x > previous.left + previous.width / 2 + 1;
      const approachesLeft =
        !indent ||
        route.some(
          (point) => Math.hypot(point.x - (box.left - 1), point.y - y) < 1,
        );
      return throughCenter && approachesLeft;
    });
  });
}

async function checkLevelGuides(page) {
  await page.waitForFunction(() => {
    const guide = document.querySelector(".even-trace-level-guides");
    const content = guide?.closest(".even-trace-path-content");
    if (!content) return false;
    const segments = [
      ...(guide.getAttribute("d") ?? "").matchAll(
        /M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)/g,
      ),
    ].map((match) => match.slice(1).map(Number));
    const groups = [...content.querySelectorAll('[role="group"]')];

    const matrix = guide.getScreenCTM();
    const center = (row) => {
      const box = row
        .querySelector(".even-trace-path-node")
        .getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    return (
      segments.length === groups.length &&
      groups.every((group) => {
        const parent = [...content.querySelectorAll('[role="treeitem"]')].find(
          (row) => row.getAttribute("aria-owns") === group.id,
        );
        const descendants = [...group.querySelectorAll('[role="treeitem"]')];
        const from = center(parent),
          to = center(descendants.at(-1));
        return segments.some(([x1, y1, x2, y2]) => {
          const start = new DOMPoint(x1, y1).matrixTransform(matrix),
            end = new DOMPoint(x2, y2).matrixTransform(matrix);
          return (
            Math.abs(x1 - x2) < 0.01 &&
            Math.hypot(start.x - from.x, start.y - from.y) < 1 &&
            Math.abs(end.x - from.x) < 1 &&
            Math.abs(end.y - to.y) < 1
          );
        });
      })
    );
  });
}

async function checkStepGap(page, previousId) {
  const result = await page
    .locator(".even-trace-route")
    .evaluate((path, previousId) => {
      const previous = document
        .querySelector(`[data-span-id="${previousId}"] .even-trace-path-node`)
        .getBoundingClientRect();
      const next = document
        .querySelector('[data-span-id="step-1"] .even-trace-path-node')
        .getBoundingClientRect();
      const matrix = path.getScreenCTM();
      const length = path.getTotalLength();
      let crosses = false;
      for (let distance = 0; distance <= length; distance += 0.5) {
        const point = path.getPointAtLength(distance).matrixTransform(matrix);
        if (point.y > previous.bottom + 1 && point.y < next.top - 1)
          crosses = true;
      }
      return {
        crosses,
        starts: (path.getAttribute("d").match(/M/g) ?? []).length,
      };
    }, previousId);
  assert.equal(result.starts, 2, "Each sibling step starts a separate route");
  assert.equal(
    result.crosses,
    false,
    "No return line crosses the gap before the next step",
  );
}

async function checkHierarchyContrast(page, theme) {
  const samples = await page
    .locator(".even-trace-rail path")
    .evaluateAll((paths) =>
      paths.map((path) => {
        const style = getComputedStyle(path);
        let opacity = Number(style.strokeOpacity);
        for (let node = path; node; node = node.parentElement)
          opacity *= Number(getComputedStyle(node).opacity);
        const probe = document.createElement("span");
        path.closest(".even-trace-path").append(probe);
        const backgrounds = [
          "surface-page",
          "surface-secondary",
          "surface-control",
          "surface-hover",
          "surface-active",
          "selection-background",
        ].map((surface) => {
          probe.style.color = `var(--even-${surface})`;
          return { surface, color: getComputedStyle(probe).color };
        });
        probe.remove();
        return { stroke: style.stroke, opacity, backgrounds };
      }),
    );
  assert.equal(
    samples.length,
    2,
    "Both meaningful hierarchy paths are checked",
  );
  for (const sample of samples) {
    assert.equal(
      sample.opacity,
      1,
      "Hierarchy strokes retain their contrast without opacity reduction",
    );
    const foreground = new Color(sample.stroke);
    assert.equal(foreground.alpha, 1);
    for (const background of sample.backgrounds)
      assert.ok(
        Color.contrastWCAG21(foreground, new Color(background.color)) >= 3,
        `${theme}: rendered hierarchy stroke meets 3:1 on ${background.surface}`,
      );
  }
  console.log(
    `Verified ${theme} rendered curve and dotted guides meet 3:1 on page, secondary, control, hover, active and selection surfaces.`,
  );
}

async function checkTitleEmphasis(page, theme) {
  const model = page.locator('[data-span-id="model-0"]');
  const logs = page.locator('[data-span-id="logs"]');
  const colors = async (row, role, surface, iconRole) =>
    row.evaluate(
      (row, { role, surface, iconRole }) => {
        const probe = document.createElement("span");
        probe.style.color = `var(--even-${role})`;
        probe.style.backgroundColor = `var(--even-${surface})`;
        row.closest(".even-trace-path").append(probe);
        const result = {
          title: getComputedStyle(row.querySelector(".even-trace-path-name"))
            .color,
          expected: getComputedStyle(probe).color,
          background: getComputedStyle(probe).backgroundColor,
          category: getComputedStyle(
            row.querySelector(".even-trace-object-category"),
          ).color,
          icon: getComputedStyle(
            row.querySelector(".even-trace-path-node .even-trace-path-marker"),
          ).borderTopColor,
          markerFill: getComputedStyle(
            row.querySelector(".even-trace-path-marker"),
          ).backgroundColor,
        };
        probe.style.color = `var(--even-${iconRole})`;
        result.expectedIcon = getComputedStyle(probe).color;
        probe.style.color = `var(--even-${role === "selection-foreground" ? "selection-foreground" : "text-secondary"})`;
        result.expectedMetrics = getComputedStyle(probe).color;
        result.iconBackground = getComputedStyle(
          row.querySelector(".even-trace-path-node"),
        ).backgroundColor;
        probe.remove();
        return result;
      },
      { role, surface, iconRole },
    );
  const check = async (row, role, surface, iconRole = role) => {
    const sample = await colors(row, role, surface, iconRole);
    assert.ok(
      new Color(sample.title).deltaE(new Color(sample.expected), "OK") < 0.001,
      `${theme}: title uses ${role}`,
    );
    assert.ok(
      Color.contrastWCAG21(
        new Color(sample.title),
        new Color(sample.background),
      ) >= 4.5,
      `${theme}: ${role} title meets 4.5:1`,
    );
    for (const color of [sample.category]) {
      assert.ok(
        new Color(color).deltaE(new Color(sample.expectedMetrics), "OK") <
          0.001,
        `${theme}: category labels use the intended foreground`,
      );
      assert.ok(
        Color.contrastWCAG21(new Color(color), new Color(sample.background)) >=
          4.5,
        `${theme}: category labels meet 4.5:1`,
      );
    }
    assert.ok(
      new Color(sample.icon).deltaE(new Color(sample.expectedIcon), "OK") <
        0.001,
      `${theme}: marker uses ${iconRole}`,
    );
    assert.ok(
      Color.contrastWCAG21(
        new Color(sample.icon),
        new Color(sample.iconBackground),
      ) >= 3,
      `${theme}: marker meets 3:1 on its backing`,
    );
    assert.ok(
      new Color(sample.markerFill).deltaE(
        new Color(
          role === "selection-foreground"
            ? sample.expectedIcon
            : sample.iconBackground,
        ),
        "OK",
      ) < 0.001,
      "Only the selected marker is filled",
    );
    return sample;
  };
  await page.mouse.move(1, 1);
  const resting = await check(model, "text-secondary", "surface-page");
  await model.hover();
  const hovered = await check(model, "text-primary", "surface-hover");
  assert.equal(
    hovered.category,
    resting.category,
    "Category labels retain secondary emphasis",
  );
  assert.notEqual(
    hovered.icon,
    resting.icon,
    "Marker brightens with the title",
  );
  await page.mouse.move(1, 1);
  await check(model, "text-secondary", "surface-page");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  assert.equal(
    await model.evaluate((row) => row.matches(":focus-visible")),
    true,
  );
  await check(model, "text-primary", "surface-page");
  assert.equal(
    await logs.getAttribute("aria-selected"),
    "true",
    "Keyboard focus does not change selection",
  );
  await check(
    logs,
    "selection-foreground",
    "selection-background",
    "selection-indicator",
  );
  await page.keyboard.press("Enter");
  await check(
    model,
    "selection-foreground",
    "selection-background",
    "selection-indicator",
  );
  await model.hover();
  await check(
    model,
    "selection-foreground",
    "selection-background",
    "selection-indicator",
  );
  await logs.locator(".even-trace-path-node").click();
  await page.mouse.move(1, 1);
  console.log(
    `Verified ${theme} resting, hover, keyboard-focus and selected title/icon tokens, selection precedence and text/icon contrast.`,
  );
}

async function checkContinuousRail(page, base, theme) {
  const open = async (story) => {
    await page.goto(
      `${base}/iframe.html?id=trace-viewer-tracepath--${story}&viewMode=story&globals=theme:${theme}`,
    );
    await page.getByRole("tree").waitFor();
    await checkRail(page);
    await checkLevelGuides(page);
  };
  await open("default");
  await checkStepGap(page, "research");
  await checkTitleEmphasis(page, theme);
  await checkHierarchyContrast(page, theme);
  const stations = await page
    .locator(".even-trace-path-node")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const icon = node.querySelector(".even-trace-path-marker"),
          style = getComputedStyle(node);
        const row = node.closest('[role="treeitem"]');
        return {
          stroke: getComputedStyle(icon).borderTopColor,
          bg: style.backgroundColor,
          iconCount: [
            ...row.querySelectorAll(".even-trace-path-marker"),
          ].filter((icon) => getComputedStyle(icon).display !== "none").length,
        };
      }),
    );
  for (const station of stations) {
    assert.equal(
      station.iconCount,
      1,
      "One neutral marker anchors each object row",
    );
    assert.ok(
      Color.contrastWCAG21(new Color(station.stroke), new Color(station.bg)) >=
        3,
      "Selected and unselected path markers meet 3:1",
    );
  }
  const leafStation = page.locator(
    '[data-span-id="logs"] .even-trace-path-node',
  );
  await leafStation.click();
  assert.equal(
    await page.locator('[data-span-id="logs"]').getAttribute("aria-selected"),
    "true",
  );
  const before = await page.locator(".even-trace-route").getAttribute("d");
  const control = page.getByRole("button", {
    name: "Collapse Step 0",
    exact: true,
  });
  assert.equal(
    await control.textContent(),
    "",
    "A neutral marker retains the branch disclosure target",
  );
  assert.equal(await control.locator(".even-trace-path-marker").count(), 1);
  const rowBoxes = await page
    .getByRole("treeitem")
    .evaluateAll((rows) =>
      rows.map((row) => ({ y: row.getBoundingClientRect().y })),
    );
  for (let i = 1; i < rowBoxes.length; i++)
    assert.ok(
      rowBoxes[i].y - rowBoxes[i - 1].y >= 40,
      "One-line objects have additional vertical breathing room",
    );
  const guides = await page
    .locator(".even-trace-level-guides")
    .getAttribute("d");
  await page.getByRole("treeitem", { name: /^Subagent Research\b/ }).hover();
  await page.getByRole("treeitem", { name: /^Span custom\.cache/ }).click();
  assert.equal(
    await page.locator(".even-trace-level-guides").getAttribute("d"),
    guides,
    "Level references stay fixed across hover and selection",
  );
  assert.ok(
    before.includes("Q"),
    "Indent changes produce rounded right-angle elbows",
  );
  await page
    .getByRole("button", { name: "Collapse Step 0", exact: true })
    .click();
  assert.equal(await page.locator(".even-trace-path-node").count(), 5);
  await checkRail(page);
  await checkLevelGuides(page);
  await checkStepGap(page, "step-0");
  assert.notEqual(
    await page.locator(".even-trace-route").getAttribute("d"),
    before,
  );
  await page
    .getByRole("button", { name: "Expand Step 0", exact: true })
    .click();
  await checkRail(page);
  await page.getByRole("treeitem", { name: /^Step 1\b/ }).hover();
  await page.screenshot({ path: `/tmp/even-continuous-rail-${theme}.png` });
  await open("long-titles");
  await page.setViewportSize({ width: 340, height: 800 });
  await page.mouse.move(1, 1);
  await checkRail(page);
  await checkLevelGuides(page);
  const alignment = await page
    .locator(".even-trace-object")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const pathIcon = row
          .closest('[role="treeitem"]')
          .querySelector(".even-trace-path-node");
        const nodes = [pathIcon, row.querySelector(".even-trace-path-name")];
        const children = nodes.map((node) => node.getBoundingClientRect());
        const center = (box) => box.y + box.height / 2;
        const [icon, title] = children;
        return {
          centerError:
            Math.max(...children.map(center)) -
            Math.min(...children.map(center)),
          ordered: icon.right <= title.left + 1,
          overflow: row.scrollWidth > row.clientWidth + 1,
          readableTitle: title.width > 0,
          hiddenIcon: nodes[0].getAttribute("aria-hidden"),
        };
      }),
    );
  for (const row of alignment) {
    assert.ok(
      row.centerError < 1 && row.ordered,
      "Marker and title share one row in order",
    );
    assert.equal(row.overflow, false, "Narrow objects contain title overflow");
    assert.equal(
      row.readableTitle,
      true,
      "Category labels never consume the entire title",
    );
    assert.equal(row.hiddenIcon, "true");
  }
  const expectedCategories = {
    "model-0": "Model",
    logs: "Tool",
    skill: "Skill",
    dispatch: "Delegation",
    research: "Subagent",
    custom: "Span",
  };
  for (const [id, category] of Object.entries(expectedCategories))
    assert.equal(
      await page
        .locator(`[data-span-id="${id}"] .even-trace-object-category`)
        .textContent(),
      category,
    );
  assert.equal(
    await page
      .locator('[data-span-id="step-0"] .even-trace-object-category')
      .count(),
    0,
    "Step titles do not repeat their category",
  );
  const heights = await page
    .getByRole("treeitem")
    .evaluateAll((rows) =>
      rows.map((row) => row.getBoundingClientRect().height),
    );
  assert.ok(
    Math.max(...heights) - Math.min(...heights) < 1,
    "Long titles stay on one row at narrow widths",
  );
  // Root text sizing changes every rem-based inset, and preview scaling changes
  // screen coordinates without changing the SVG's local coordinate system.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "20px";
    const content = document.querySelector(".even-trace-path-content");
    content.style.transformOrigin = "top left";
    content.style.transform = "scale(0.8)";
  });
  await checkRail(page);
  await checkLevelGuides(page);
  await page.screenshot({
    path: `/tmp/even-continuous-rail-long-title-${theme}.png`,
  });
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await page.setViewportSize({ width: 1280, height: 850 });
  await open("collapsed");
  assert.equal(await page.locator(".even-trace-path-node").count(), 2);
  await checkStepGap(page, "step-0");
  await open("no-steps");
  assert.equal(
    (await page.locator(".even-trace-route").getAttribute("d")).match(/M/g)
      .length,
    1,
    "Traces without recorded steps retain their route",
  );
  await open("missing-parents-and-cycles");
  assert.equal(await page.locator(".even-trace-path-node").count(), 3);
  await page.getByRole("treeitem").first().hover();
  assert.equal(
    await page.locator(".even-trace-level-guides").getAttribute("d"),
    "",
  );
  console.log(
    `Verified ${theme} continuous rail through collapse/expand, single-row titles, narrow layout, text sizing, preview scaling and partial traces and branch-scoped dotted level guides.`,
  );
}

async function checkScopeNavigation(page, base, theme) {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    `${base}/iframe.html?id=trace-viewer-traceviewer--composed&viewMode=story&globals=theme:${theme}`,
  );
  const viewer = page.getByRole("region", {
    name: "Trace viewer",
    exact: true,
  });
  await viewer.waitFor();
  const frame = await viewer.boundingBox();
  const header = await page.getByRole("navigation").boundingBox();
  assert.equal(
    await page
      .getByRole("treeitem", { name: /^Subagent Research\b/ })
      .locator(".even-trace-open-icon")
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("treeitem", { name: /^Tool read_logs\b/ })
      .locator(".even-trace-open-icon")
      .count(),
    0,
  );
  await page.getByRole("treeitem", { name: /^Subagent Research\b/ }).click();
  const inspect = () =>
    viewer.evaluate((root) => {
      const animations = root.getAnimations({ subtree: true });
      animations.forEach((animation) => {
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration * 0.7;
      });
      const snapshots = [
        ...root.querySelector(".even-trace-scope-snapshot").children,
      ];
      const live = [...root.querySelectorAll("[data-trace-surface]")];
      return {
        direction: root.dataset.scopeTransition,
        snapshots: snapshots.length,
        safe: snapshots.every(
          (node) =>
            node.inert &&
            node.getAttribute("aria-hidden") === "true" &&
            !node.querySelector("[id], [tabindex='0']"),
        ),
        frames: animations.map((animation) => ({
          frames: animation.effect.getKeyframes(),
          duration: animation.effect.getTiming().duration,
        })),
        transforms: live.map((node) => {
          const m = new DOMMatrix(getComputedStyle(node).transform);
          return [m.a, m.d, m.e];
        }),
        outgoingOpacity: snapshots.map((node) =>
          Number(getComputedStyle(node).opacity),
        ),
      };
    });
  let motion = await inspect();
  assert.equal(motion.direction, "forward");
  assert.equal(motion.snapshots, 2);
  assert.equal(
    motion.safe,
    true,
    "Outgoing decoration has no duplicate IDs or keyboard targets",
  );
  assert.equal(motion.frames.length, 4);
  assert.ok(motion.frames.every((animation) => animation.duration === 350));
  assert.ok(
    motion.transforms.every(
      ([x, y, translation]) => x === 1 && y === 1 && translation > 0,
    ),
    "Entering content comes from the right without scaling",
  );
  assert.ok(
    motion.outgoingOpacity.every((opacity) => opacity === 0),
    "Outgoing and incoming text do not overlap",
  );
  assert.deepEqual(
    await viewer.boundingBox(),
    frame,
    "Viewer frame remains fixed",
  );
  const nestedHeader = await page.getByRole("navigation").boundingBox();
  assert.equal(nestedHeader.y, header.y);
  assert.equal(nestedHeader.height, header.height);
  assert.equal(
    await page.getByRole("tree").count(),
    1,
    "Only the live execution is exposed",
  );
  assert.equal(
    await page
      .getByRole("region", { name: "raw span JSON content", exact: true })
      .count(),
    1,
  );
  await page.screenshot({ path: `/tmp/even-scope-navigation-${theme}.png` });
  await viewer.evaluate((root) =>
    root
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.finish()),
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  await page.getByRole("button", { name: "Back to Support" }).click();
  motion = await inspect();
  assert.equal(motion.direction, "back");
  assert.ok(
    motion.transforms.every(
      ([x, y, translation]) => x === 1 && y === 1 && translation < 0,
    ),
    "Returning reverses direction",
  );
  const child = page.getByRole("treeitem", { name: /^Subagent Research\b/ });
  assert.equal(await child.getAttribute("aria-selected"), "true");
  // Keyboard interrupts decoration and performs its own navigation immediately.
  await child.press("Enter");
  assert.equal(await viewer.getAttribute("data-scope-transition"), null);
  assert.equal(
    await page.getByRole("button", { name: "Back to Support" }).count(),
    1,
  );
  assert.equal(
    await viewer.locator(".even-trace-scope-snapshot > *").count(),
    0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Back to Support" }).click();
  motion = await inspect();
  assert.ok(motion.frames.every((animation) => animation.duration === 100));
  assert.ok(
    motion.transforms.every(
      ([x, y, translation]) => x === 1 && y === 1 && translation === 0,
    ),
    "Reduced motion only changes opacity",
  );
  await page.screenshot({ path: `/tmp/even-scope-reduced-${theme}.png` });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  // Several native clicks in one task must leave the newest scope, no queue.
  await viewer.evaluate((root) => {
    root
      .querySelector('[data-trace-surface="path"] [data-span-id="research"]')
      .click();
  });
  await page
    .getByRole("button", { name: "Back to Support" })
    .dispatchEvent("click");
  await page
    .getByRole("treeitem", { name: /^Subagent Research\b/ })
    .dispatchEvent("click");
  assert.equal(
    await page.getByRole("button", { name: "Back to Support" }).count(),
    1,
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  assert.equal(
    await viewer.locator(".even-trace-scope-snapshot > *").count(),
    0,
  );
  await viewer.evaluate((root) =>
    root.style.setProperty("--even-motion-duration-move-large", "0.6s"),
  );
  await page.getByRole("button", { name: "Back to Support" }).click();
  motion = await inspect();
  assert.ok(
    motion.frames.every((animation) => animation.duration === 600),
    "Motion reads caller decision overrides",
  );
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  assert.equal(
    await viewer.locator(".even-trace-scope-snapshot > *").count(),
    0,
  );
  await page.setViewportSize({ width: 300, height: 800 });
  const pathPane = viewer.locator('[data-trace-surface="path"]');
  const horizontal = await pathPane.evaluate((node) => {
    node.scrollLeft = 30;
    node.dispatchEvent(new Event("scroll"));
    return node.scrollLeft;
  });
  assert.ok(
    horizontal > 0,
    "Narrow hierarchy scrolls instead of hiding titles",
  );
  await page
    .getByRole("treeitem", { name: /^Subagent Research\b/ })
    .dispatchEvent("click");
  await page
    .getByRole("button", { name: "Back to Support" })
    .dispatchEvent("click");
  assert.equal(
    await pathPane.evaluate((node) => node.scrollLeft),
    horizontal,
    "Returning restores the horizontal reading position",
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  console.log(
    `Verified ${theme} directional subagent navigation, stable breadcrumb/frame, parent selection, safe snapshots, interruption, keyboard immediacy, reduced motion and timing overrides.`,
  );
}

async function checkCategoryLabelDecisions(page, base, theme) {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto(
    `${base}/iframe.html?id=trace-viewer-traceviewer--category-pill-mockup&viewMode=story&globals=theme:${theme}`,
  );
  const viewer = page.getByRole("region", {
    name: "Trace viewer",
    exact: true,
  });
  await viewer.waitFor();
  const labels = page.locator(
    '.even-trace-object[data-category-appearance="label"] :is(.even-trace-object-category, .even-trace-object[data-category="Step"] .even-trace-path-name)',
  );
  const styles = () =>
    labels.evaluateAll((nodes) =>
      nodes.map((node) => {
        const row = node.closest('[role="treeitem"]');
        const selected = row.getAttribute("aria-selected") === "true";
        const probe = document.createElement("span");
        probe.style.color = selected
          ? "var(--even-selection-foreground)"
          : "var(--even-label-foreground)";
        probe.style.backgroundColor = selected
          ? "var(--even-label-selected-background)"
          : "var(--even-label-background)";
        probe.style.borderRadius = "var(--even-size-radius-pill)";
        row.append(probe);
        const actual = getComputedStyle(node),
          expected = getComputedStyle(probe);
        const rowFill = getComputedStyle(row, "::before").backgroundColor;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        context.fillStyle = getComputedStyle(
          row.closest(".even-trace-viewer"),
        ).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = rowFill;
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = actual.backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        const result = {
          fg: actual.color,
          bg: actual.backgroundColor,
          radius: actual.borderTopLeftRadius,
          expectedFg: expected.color,
          expectedBg: expected.backgroundColor,
          expectedRadius: expected.borderTopLeftRadius,
          composite: `rgb(${r}, ${g}, ${b})`,
          opacity: actual.opacity,
          height: node.getBoundingClientRect().height,
          corners: [
            actual.borderTopLeftRadius,
            actual.borderTopRightRadius,
            actual.borderBottomLeftRadius,
            actual.borderBottomRightRadius,
          ],
          fits: node.scrollWidth <= node.clientWidth + 1,
        };
        probe.remove();
        return result;
      }),
    );
  const assertDecisions = async () => {
    const samples = await styles();
    assert.equal(
      samples.length,
      9,
      "Each row has one category label, including Step 0 itself",
    );
    for (const sample of samples) {
      assert.ok(
        new Color(sample.fg).deltaE(new Color(sample.expectedFg), "OK") < 0.001,
        "Label foreground uses its intended decision",
      );
      assert.ok(
        new Color(sample.bg).deltaE(new Color(sample.expectedBg), "OK") < 0.001,
        "Label background uses its intended decision",
      );
      assert.ok(
        Math.abs(
          new Color(sample.bg).alpha - new Color(sample.expectedBg).alpha,
        ) < 0.00001,
        "Labels preserve the overlay alpha",
      );
      assert.equal(
        sample.opacity,
        "1",
        "Only the fill is translucent; text remains opaque",
      );
      assert.equal(
        sample.radius,
        sample.expectedRadius,
        "Labels use the pill-radius decision",
      );
      assert.ok(
        Color.contrastWCAG21(
          new Color(sample.fg),
          new Color(sample.composite),
        ) >= 4.5,
      );
      assert.equal(sample.fits, true, "Full category text fits in its label");
    }
    return samples;
  };
  await assertDecisions();
  for (const pill of await styles()) {
    assert.ok(
      pill.corners.every((corner) => parseFloat(corner) >= pill.height / 2),
      "All four corners form fully rounded capsule ends",
    );
  }
  await page
    .getByRole("treeitem", { name: "Tool read_logs", exact: true })
    .hover();
  await assertDecisions();
  await page.getByRole("treeitem", { name: "Step 0", exact: true }).focus();
  await page.keyboard.press("Enter");
  await assertDecisions();
  await page
    .getByRole("treeitem", { name: "Tool read_logs", exact: true })
    .click();
  await page
    .locator(".even-trace-path")
    .screenshot({ path: `/tmp/even-category-pill-rounded-${theme}.png` });
  const before = await styles();
  assert.ok(
    new Color(before[0].bg).alpha > 0 && new Color(before[0].bg).alpha < 1,
  );
  assert.ok(
    new Color(before[2].bg).alpha > new Color(before[0].bg).alpha &&
      new Color(before[2].bg).alpha < 1,
    "Selected pills use a stronger overlay while still showing the row beneath",
  );
  assert.notEqual(
    before[0].composite,
    before[2].composite,
    "The selected row shows through the label",
  );
  await viewer.evaluate((root) => {
    root.style.setProperty("--even-surface-active", "rgb(255, 0, 255)");
    root.style.setProperty("--even-size-radius-panel", "2rem");
    root.style.setProperty("--even-size-radius-control", "0.5rem");
    root.style.setProperty("--even-text-primary", "rgb(255, 0, 255)");
  });
  assert.deepEqual(
    await styles(),
    before,
    "Active controls, floating panels and primary text do not drive passive/selected labels",
  );
  await viewer.evaluate((root) => {
    root.style.removeProperty("--even-surface-active");
    root.style.removeProperty("--even-size-radius-panel");
    root.style.removeProperty("--even-size-radius-control");
    root.style.removeProperty("--even-text-primary");
    root.style.setProperty(
      "--even-label-background",
      "var(--even-surface-control)",
    );
    root.style.setProperty(
      "--even-label-selected-background",
      "var(--even-selection-background)",
    );
    root.style.setProperty("--even-size-radius-pill", "0.75rem");
  });
  const overridden = await assertDecisions();
  assert.notEqual(
    overridden[0].bg,
    before[0].bg,
    "Passive labels consume live label decision overrides",
  );
  assert.notEqual(
    overridden[2].bg,
    before[2].bg,
    "Selected labels consume their selected overlay decision",
  );
  assert.notEqual(overridden[0].radius, before[0].radius);
  await page.setViewportSize({ width: 390, height: 800 });
  await assertDecisions();
  console.log(
    `Verified ${theme} shared category-label decisions, fully rounded pill corners, selected foreground, contrast, narrow layout and independent token overrides.`,
  );
}

export async function checkTraceViewer(page, base, theme, axe) {
  await checkCategoryLabelDecisions(page, base, theme);
  await checkScopeNavigation(page, base, theme);
  await checkContinuousRail(page, base, theme);
  await page.setViewportSize({ width: 1280, height: 850 });
  const open = async (story) => {
    await page.goto(
      `${base}/iframe.html?id=trace-viewer-traceviewer--${story}&viewMode=story&globals=theme:${theme}`,
    );
    await page
      .getByRole("region", { name: "Trace viewer", exact: true })
      .waitFor();
  };
  const raw = () =>
    page
      .getByRole("region", { name: "raw span JSON content", exact: true })
      .textContent();
  await open("composed");
  await checkRail(page);
  assert.equal(JSON.parse(await raw()).spanId, "logs");
  assert.equal(
    await page
      .getByRole("heading", { name: /Execution path|Raw span JSON/ })
      .count(),
    0,
  );
  const copy = page.getByRole("button", {
    name: "Copy raw span JSON",
    exact: true,
  });
  assert.equal(await copy.count(), 1);
  assert.equal(await copy.textContent(), "");
  assert.equal(
    await page
      .locator(".even-payload-toolbar")
      .getByText("JSON", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("treeitem", { name: /^Support\b/ }).count(),
    0,
  );
  await page.getByRole("button", { name: "Support", exact: true }).click();
  assert.equal(JSON.parse(await raw()).spanId, "support");
  await page.getByRole("treeitem", { name: /^Tool read_logs\b/ }).click();
  await page.getByRole("treeitem", { name: /^Subagent Research\b/ }).click();
  assert.equal(JSON.parse(await raw()).spanId, "research-step");
  await checkRail(page);
  await page
    .getByRole("treeitem", { name: /^Subagent Source\ checking\b/ })
    .click();
  assert.equal(JSON.parse(await raw()).spanId, "source-step");
  await checkRail(page);
  await page.getByRole("button", { name: "Research", exact: true }).click();
  assert.equal(JSON.parse(await raw()).spanId, "source");
  await page.getByRole("button", { name: "Support", exact: true }).click();
  assert.equal(JSON.parse(await raw()).spanId, "research");
  assert.equal(
    await page
      .getByRole("treeitem", { name: /^Subagent Research\b/ })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.getByRole("treeitem", { name: /^Tool read_logs\b/ }).click();
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  const original = await raw();
  await page.evaluate(() => {
    window.copiedSpan = undefined;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.copiedSpan = value;
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Copy raw span JSON", exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.copiedSpan), original);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Fixture clipboard denial");
    };
  });
  await copy.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Copy failed. Try again." })
    .waitFor();
  await page.evaluate(() => {
    navigator.clipboard.writeText = async (value) => {
      window.copiedSpan = value;
    };
  });
  await copy.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Copied." })
    .waitFor({ state: "attached" });
  const contrasts = await page
    .locator(".even-payload pre > span")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: getComputedStyle(node).color,
        bg: getComputedStyle(node.closest("pre")).backgroundColor,
      })),
    );
  for (const pair of contrasts)
    assert.ok(
      Color.contrastWCAG21(new Color(pair.text), new Color(pair.bg)) >= 4.5,
      `JSON syntax text meets contrast in ${theme}`,
    );
  if (axe) {
    await page.addScriptTag({ content: axe });
    assert.deepEqual(
      (
        await page.evaluate(() =>
          window.axe.run(document.body, {
            rules: { region: { enabled: false } },
          }),
        )
      ).violations,
      [],
    );
  }
  await open("long-execution");
  const path = page.locator('[data-trace-surface="path"]');
  const code = page.getByRole("region", {
    name: "raw span JSON content",
    exact: true,
  });
  assert.ok(
    await path.evaluate((node) => node.scrollHeight > node.clientHeight),
  );
  await path.evaluate((node) => {
    node.scrollTop = 120;
  });
  await page.waitForFunction(
    () => document.querySelector(".even-trace-viewer-path").scrollTop === 120,
  );
  await page.getByRole("treeitem", { name: /^Subagent Research\b/ }).click();
  await page.getByRole("button", { name: "Support", exact: true }).click();
  // The click can reveal Research before navigation; capture/restoration follows
  // actual viewport movement, not a guessed scroll offset.
  assert.ok(await path.evaluate((node) => node.scrollTop > 0));
  await page
    .locator('[data-trace-surface="path"] [data-span-id="model-1"]')
    .click();
  await page.waitForFunction(
    () => !document.querySelector("[data-scope-transition]"),
  );
  const before = await path.evaluate((node) => node.scrollTop);
  assert.ok(
    await code.evaluate(
      (node) =>
        node.scrollHeight > node.clientHeight &&
        node.scrollWidth > node.clientWidth,
    ),
    "Long JSON overflows in both axes",
  );
  const toolsBefore = await page.locator(".even-payload-toolbar").boundingBox();
  await code.evaluate((node) => {
    node.scrollTop = 30;
    node.scrollLeft = 30;
  });
  assert.deepEqual(
    await code.evaluate((node) => [node.scrollTop, node.scrollLeft]),
    [30, 30],
  );
  assert.deepEqual(
    await page.locator(".even-payload-toolbar").boundingBox(),
    toolsBefore,
    "JSON tools stay fixed while the code scrolls",
  );
  const codeBox = await code.boundingBox();
  assert.ok(
    codeBox.y >= toolsBefore.y + toolsBefore.height - 1,
    "Tools do not obscure JSON",
  );
  assert.equal(await path.evaluate((node) => node.scrollTop), before);
  await page.setViewportSize({ width: 390, height: 800 });
  const bounds = await page.locator(".even-trace-viewer").evaluate((node) => ({
    client: node.clientWidth,
    scroll: node.scrollWidth,
  }));
  assert.ok(
    bounds.scroll <= bounds.client + 1,
    "Narrow layout contains horizontal overflow",
  );
  const pathBox = await path.boundingBox(),
    rawBox = await page.locator(".even-trace-raw-panel").boundingBox();
  assert.ok(
    rawBox.y >= pathBox.y + pathBox.height - 1,
    "Narrow layout stacks the raw panel below the bounded path",
  );
  await page.screenshot({ path: `/tmp/even-viewer-mobile-${theme}.png` });
  await page.setViewportSize({ width: 1280, height: 850 });
  await open("partial-trace");
  assert.equal(await page.getByRole("treeitem").count(), 3);
  await open("composed");
  const step = page.getByRole("treeitem", { name: /^Step 0\b/ });
  assert.equal(
    await page.locator(".even-trace-path-tree .even-trace-path-meta").count(),
    0,
  );
  assert.equal((await step.textContent()).trim(), "Step 0");
  await step.click();
  const metrics = page.getByRole("group", { name: "Selected span metrics" });
  assert.ok((await metrics.textContent()).includes("1.50 s"));
  assert.ok((await metrics.textContent()).includes("170 tokens"));
  const metricBox = await metrics.boundingBox();
  const jsonToolsBox = await page
    .locator(".even-trace-raw-format")
    .boundingBox();
  const preBox = await page
    .getByRole("region", { name: "raw span JSON content", exact: true })
    .boundingBox();
  const codeInset = await page
    .getByRole("region", { name: "raw span JSON content", exact: true })
    .evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft));
  assert.ok(
    Math.abs(metricBox.x - preBox.x - codeInset) < 1,
    "Metrics align to the code inset",
  );
  assert.ok(
    metricBox.x + metricBox.width <= jsonToolsBox.x,
    "Metrics sit to the left of JSON controls",
  );
  await page.getByRole("treeitem", { name: /^Tool read_logs\b/ }).click();
  assert.equal((await metrics.textContent()).trim(), "420 ms");
  const aligned = await page
    .locator(
      '[data-span-id="model-0"] .even-trace-path-name, [data-span-id="dispatch"] .even-trace-path-name',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().left),
    );
  assert.ok(
    Math.abs(aligned[0] - aligned[1]) < 1,
    "Objects at the same depth reserve the same control slot",
  );
  await page.screenshot({ path: `/tmp/even-viewer-composed-${theme}.png` });
  console.log(
    `Verified ${theme} trace drill-in/back navigation, raw JSON fidelity/copy, syntax contrast, focus, independent scrolling, partial traces and narrow layout.`,
  );
}
