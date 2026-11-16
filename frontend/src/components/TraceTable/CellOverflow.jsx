import React, { useLayoutEffect, useRef, useState } from "react";

// Internal table presentation: preserve the original semantic content and its
// accessible name. Only its painted portion is masked; the marker is decorative.
export function CellOverflow({ children }) {
  const rootRef = useRef(null);
  const textRef = useRef(null);
  const markerRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const text = textRef.current;
    const marker = markerRef.current;
    let active = true;
    function measure() {
      if (!active) return;
      const range = document.createRange();
      if (
        typeof Intl.Segmenter !== "function" ||
        typeof range.getBoundingClientRect !== "function" ||
        getComputedStyle(root).direction !== "ltr"
      )
        return;
      const bounds = text.getBoundingClientRect();
      const width = root.getBoundingClientRect().width;
      const overflowing = bounds.width > width;
      let cutoff = bounds.width;
      if (overflowing) {
        const available = Math.max(
          0,
          width - marker.getBoundingClientRect().width,
        );
        const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node,
          offset = 0;
        while ((node = walker.nextNode())) {
          nodes.push({ node, start: offset, end: offset + node.length });
          offset += node.length;
        }
        const segments = new Intl.Segmenter(undefined, {
          granularity: "grapheme",
        }).segment(text.textContent);
        cutoff = 0;
        for (const { index, segment } of segments) {
          const start = nodes.find((item) => item.end > index);
          const endIndex = index + segment.length;
          const end = nodes.find((item) => item.end >= endIndex);
          range.setStart(start.node, index - start.start);
          range.setEnd(end.node, endIndex - end.start);
          const rect = range.getBoundingClientRect();
          const right = rect.right - bounds.left;
          if (right > available) break;
          cutoff = Math.max(cutoff, right);
        }
      }
      const next = {
        overflowing,
        cutoff,
        hidden: Math.max(0, bounds.width - cutoff),
      };
      setLayout((previous) =>
        previous?.overflowing === next.overflowing &&
        previous?.cutoff === next.cutoff &&
        previous?.hidden === next.hidden
          ? previous
          : next,
      );
    }
    measure();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resize?.observe(root);
    resize?.observe(text);
    resize?.observe(marker);
    document.fonts?.ready.then(measure);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      active = false;
      resize?.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [children]);

  return (
    <span
      className="even-trace-cell-content even-cell-overflow"
      ref={rootRef}
      data-overflow={layout?.overflowing || undefined}
      data-native-overflow={!layout || undefined}
    >
      <span
        className="even-cell-overflow-text"
        ref={textRef}
        style={
          layout?.overflowing
            ? { clipPath: `inset(0 ${layout.hidden}px 0 0)` }
            : undefined
        }
      >
        {children}
      </span>
      <span
        className="even-cell-overflow-marker"
        ref={markerRef}
        aria-hidden="true"
      >
        …
      </span>
    </span>
  );
}
