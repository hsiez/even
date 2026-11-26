import React, { useLayoutEffect, useRef } from "react";

// One SVG route with separate subpaths at step boundaries.
export function railPath(points, cornerRadius = 0) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const next = points[index];
    if (next.breakBefore) {
      path += ` M ${next.x} ${next.y}`;
      continue;
    }
    if (Math.abs(previous.x - next.x) < 0.01) {
      path += ` L ${next.x} ${next.y}`;
      continue;
    }
    const gap = next.y - previous.y;
    const radius = Math.min(
      cornerRadius,
      Math.abs(next.x - previous.x) / 2,
      gap / 4,
    );
    if (next.x > previous.x) {
      // Enter a deeper level horizontally from the marker's left, so the
      // parent column remains legible instead of making a diagonal S-bend.
      path += ` L ${previous.x} ${next.y - radius} Q ${previous.x} ${next.y} ${previous.x + radius} ${next.y} L ${next.x} ${next.y}`;
    } else {
      const middle = previous.y + gap / 2;
      path += ` L ${previous.x} ${middle - radius} Q ${previous.x} ${middle} ${previous.x - radius} ${middle} L ${next.x + radius} ${middle} Q ${next.x} ${middle} ${next.x} ${middle + radius} L ${next.x} ${next.y}`;
    }
  }
  return path;
}

export function TraceRail({ contentRef }) {
  const pathRef = useRef(null);
  const guideRef = useRef(null);
  useLayoutEffect(() => {
    const path = pathRef.current;
    const guide = guideRef.current;
    // Child layout effects can run before the parent wrapper's ref attaches.
    const content =
      contentRef.current ?? path?.closest(".even-trace-path-content");
    const tree = content?.querySelector('[role="tree"]');
    if (!tree || !path || !guide) return;
    const rowFrom = (dot) => dot.closest('[role="treeitem"]');
    const isStep = (row) =>
      row?.querySelector(".even-trace-object")?.dataset.category === "Step";
    function ancestors(row) {
      const parents = [];
      let group = row?.closest('[role="group"]');
      while (group) {
        const parent = group.parentElement.querySelector(
          ':scope > [role="treeitem"]',
        );
        if (!parent) break;
        parents.push(parent);
        group = parent.closest('[role="group"]');
      }
      return parents;
    }
    function measure() {
      const box = content.getBoundingClientRect();
      if (!box.width || !box.height) {
        path.removeAttribute("d");
        guide.removeAttribute("d");
        return;
      }
      // Work in local CSS coordinates, including inside a scaled preview.
      const style = getComputedStyle(content);
      const scaleX = box.width / parseFloat(style.width);
      const scaleY = box.height / parseFloat(style.height);
      const rows = new Map();
      const markers = [...tree.querySelectorAll(".even-trace-path-node")];
      const points = markers.map((dot, index) => {
        const marker = dot.getBoundingClientRect();
        const row = rowFrom(dot);
        const previous = index ? rowFrom(markers[index - 1]) : null;
        const previousStep = [previous, ...ancestors(previous)].find(isStep);
        const point = {
          x: (marker.left + marker.width / 2 - box.left) / scaleX,
          y: (marker.top + marker.height / 2 - box.top) / scaleY,
          // A new sibling/ancestor-level step starts its own path. Preserve
          // genuine parent-to-child links if a trace records nested steps.
          breakBefore:
            isStep(row) &&
            !!previousStep &&
            !ancestors(row).includes(previousStep),
        };
        rows.set(row, point);
        return point;
      });
      // The existing control radius resolves rem/caller overrides to pixels.
      const radius = markers.length
        ? parseFloat(getComputedStyle(markers[0]).borderTopLeftRadius) || 0
        : 0;
      path.setAttribute("d", railPath(points, radius));

      // Persistent level references follow each expanded branch's extent.
      const groups = new Map(
        [...tree.querySelectorAll('[role="group"]')].map((group) => [
          group.id,
          group,
        ]),
      );
      const guides = [];
      for (const [row, from] of rows) {
        const group = groups.get(row.getAttribute("aria-owns"));
        const lastDot = group?.querySelectorAll(".even-trace-path-node");
        const to = lastDot?.length
          ? rows.get(rowFrom(lastDot[lastDot.length - 1]))
          : null;
        if (to) guides.push(`M ${from.x} ${from.y} L ${from.x} ${to.y}`);
      }
      guide.setAttribute("d", guides.join(" "));
    }
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    function observeRows() {
      resize?.disconnect();
      resize?.observe(content);
      for (const row of tree.querySelectorAll(
        '[role="treeitem"], .even-trace-path-node',
      ))
        resize?.observe(row);
      measure();
    }
    const mutations = new MutationObserver(observeRows);
    mutations.observe(tree, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-expanded"],
    });
    observeRows();
    return () => {
      mutations.disconnect();
      resize?.disconnect();
    };
  }, [contentRef]);
  return (
    <svg className="even-trace-rail" aria-hidden="true" focusable="false">
      <path ref={guideRef} className="even-trace-level-guides" />
      <path ref={pathRef} className="even-trace-route" />
    </svg>
  );
}
