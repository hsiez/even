import { useLayoutEffect, useRef } from "react";

const set = (node, name, value) => {
  if (node.style.getPropertyValue(name) !== value)
    node.style.setProperty(name, value);
};

// Native CSS owns the sticky constraint. Coordinate its separate decorative
// indicator and close control without duplicating Base UI's selected state.
export function useStickyTab(viewportRef, updateOverflow) {
  const selectedId = useRef(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = viewport.firstElementChild;
    const bar = viewport.closest(".even-workbench-tab-bar");
    let timer;
    function sync() {
      if (!viewport.clientWidth) return;
      let trackBox = track.getBoundingClientRect();
      // The control token is a minimum. Text/padding can make the live row taller.
      // Use CSS layout units so a scaled preview does not apply its zoom twice.
      if (bar)
        set(bar, "--even-tab-row-height", getComputedStyle(track).height);
      if (track.hasAttribute("data-creating")) return;
      const row = track.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      const viewBox = viewport.getBoundingClientRect();
      set(
        track,
        "--even-tab-viewport-start",
        `${viewBox.left - trackBox.left}px`,
      );
      set(track, "--even-tab-viewport-width", `${viewport.clientWidth}px`);
      if (!row) {
        selectedId.current = null;
        for (const close of track.querySelectorAll("[data-active-tab]")) {
          close.removeAttribute("data-active-tab");
        }
        track.dataset.stickyEdge = "";
        return;
      }
      const trigger = row.querySelector(".even-tab[data-active]");
      const count = track.querySelectorAll(".even-workbench-tab").length;
      const column = Number(row.dataset.tabColumn);
      const width = track.clientWidth / count;
      // New selection reveals its logical slot; manual scrolling only pins it.
      if (selectedId.current !== trigger.id) {
        selectedId.current = trigger.id;
        const style = getComputedStyle(viewport);
        const start = parseFloat(style.paddingInlineStart) || 0;
        const end = parseFloat(style.paddingInlineEnd) || 0;
        const left = trackBox.left + (column - 1) * width;
        if (left < viewBox.left + start)
          viewport.scrollLeft += left - viewBox.left - start;
        else if (left + width > viewBox.right - end)
          viewport.scrollLeft += left + width - viewBox.right + end;
        trackBox = track.getBoundingClientRect();
        set(
          track,
          "--even-tab-viewport-start",
          `${viewBox.left - trackBox.left}px`,
        );
      }
      const box = row.getBoundingClientRect();
      set(track, "--even-active-tab-width", `${box.width}px`);
      const shift = box.left - (trackBox.left + (column - 1) * width);
      for (const close of track.querySelectorAll(".even-workbench-tab-close")) {
        const active = close.dataset.tabColumn === row.dataset.tabColumn;
        if (close.hasAttribute("data-active-tab") !== active)
          close.toggleAttribute("data-active-tab", active);
      }
      const edge = shift > 0.5 ? "start" : shift < -0.5 ? "end" : "";
      if (track.dataset.stickyEdge !== edge) track.dataset.stickyEdge = edge;
      updateOverflow();
    }
    function scrolling() {
      track.setAttribute("data-scrolling", "");
      clearTimeout(timer);
      timer = setTimeout(() => track.removeAttribute("data-scrolling"), 120);
      sync();
    }
    function prepareScroll(event) {
      // Prime the first moving frame, but let actual scroll events extend the
      // cooldown. Trackpad tails can keep sending wheel events at a boundary.
      if (track.hasAttribute("data-scrolling")) return;
      if (event.type === "wheel") {
        const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
        const limit = viewport.scrollWidth - viewport.clientWidth;
        if (
          !delta ||
          (delta < 0 && viewport.scrollLeft <= 0) ||
          (delta > 0 && viewport.scrollLeft >= limit)
        )
          return;
      }
      scrolling();
    }
    function revealClose(event) {
      const close = event.target.closest(".even-workbench-tab-close");
      if (!close || close.hasAttribute("data-active-tab")) return;
      sync();
      const row = track.querySelector(
        ".even-workbench-tab:has(.even-tab[data-active])",
      );
      if (!row) return;
      const active = row.getBoundingClientRect();
      const target = close.getBoundingClientRect();
      const edge = track.dataset.stickyEdge;
      if (!edge) return;
      const radius = parseFloat(getComputedStyle(row).borderTopLeftRadius);
      const fade = parseFloat(getComputedStyle(track, "::before").width);
      const surround = radius + fade;
      if (
        target.left < active.right + surround &&
        target.right > active.left - surround
      ) {
        const gap =
          parseFloat(getComputedStyle(close).scrollMarginInlineStart) || 0;
        const view = viewport.getBoundingClientRect();
        const style = getComputedStyle(viewport);
        const left = Math.min(
          active.right + surround + gap,
          view.right - parseFloat(style.paddingInlineEnd) - target.width,
        );
        const right = Math.max(
          active.left - surround - gap,
          view.left + parseFloat(style.paddingInlineStart) + target.width,
        );
        viewport.scrollLeft +=
          edge === "end" ? target.right - right : target.left - left;
        sync();
      }
    }
    const mutations = new MutationObserver(sync);
    mutations.observe(track, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active", "data-creating"],
    });
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scrolling);
    resize?.observe(viewport);
    resize?.observe(track);
    viewport.addEventListener("scroll", scrolling, { passive: true });
    viewport.addEventListener("focusin", revealClose);
    viewport.addEventListener("wheel", prepareScroll, { passive: true });
    viewport.addEventListener("touchmove", prepareScroll, { passive: true });
    sync();
    return () => {
      clearTimeout(timer);
      mutations.disconnect();
      resize?.disconnect();
      viewport.removeEventListener("scroll", scrolling);
      viewport.removeEventListener("focusin", revealClose);
      viewport.removeEventListener("wheel", prepareScroll);
      viewport.removeEventListener("touchmove", prepareScroll);
    };
  }, [viewportRef, updateOverflow]);
}
