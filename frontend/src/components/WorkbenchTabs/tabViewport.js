import { readInteractionDelay } from "../../tokens/motion";

const set = (node, name, value) => {
  if (node.style.getPropertyValue(name) !== value)
    node.style.setProperty(name, value);
};

export function observeTabViewport(viewport, updateOverflow, onScrollIdle) {
  let selectedId = null;
  let alive = true;
  const track = viewport.firstElementChild;
  const bar = viewport.closest(".even-workbench-tab-bar");
  let timer;
  function sync() {
    if (!alive) return;
    updateOverflow();
    if (!viewport.clientWidth) return;
    let trackBox = track.getBoundingClientRect();

    if (bar) set(bar, "--even-tab-row-height", getComputedStyle(track).height);
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
      selectedId = null;
      for (const close of track.querySelectorAll("[data-active-tab]")) {
        close.removeAttribute("data-active-tab");
      }
      track.dataset.stickyEdge = "";
      return;
    }
    const trigger = row.querySelector(".even-tab[data-active]");
    const count = Number(track.style.getPropertyValue("--even-tab-count")) || 1;
    const column = Number(row.dataset.tabColumn);
    const width = track.clientWidth / count;

    if (selectedId !== trigger.id) {
      selectedId = trigger.id;

      if (!track.hasAttribute("data-removing")) {
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
    if (!alive) return;
    track.setAttribute("data-scrolling", "");
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        if (!alive) return;
        track.removeAttribute("data-scrolling");
        onScrollIdle();
      },
      readInteractionDelay(track, "scroll-idle"),
    );
    sync();
  }
  function prepareScroll(event) {
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
  function revealSelected(logical = false) {
    if (!alive || !viewport.clientWidth) return;
    if (track.matches("[data-creating], [data-removing]")) {
      updateOverflow();
      return;
    }
    const selected = track.querySelector('[role="tab"][aria-selected="true"]');
    if (selected) {
      const box = viewport.getBoundingClientRect();
      const row = selected.closest(".even-workbench-tab");
      const count =
        Number(track.style.getPropertyValue("--even-tab-count")) || 1;
      const width = track.clientWidth / count;
      const left =
        track.getBoundingClientRect().left +
        (Number(row.dataset.tabColumn) - 1) * width;
      const tab = logical
        ? { left, right: left + width }
        : selected.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const start = parseFloat(style.paddingInlineStart) || 0;
      const end = parseFloat(style.paddingInlineEnd) || 0;
      if (tab.left < box.left + start)
        viewport.scrollLeft += tab.left - box.left - start;
      else if (tab.right > box.right - end)
        viewport.scrollLeft += tab.right - box.right + end;
    }
    sync();
  }
  const mutations = new MutationObserver(sync);
  mutations.observe(track, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "data-active",
      "data-creating",
      "data-removing",
      "data-tab-column",
      "data-active-tab",
    ],
  });
  const resize =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          revealSelected(true);
          scrolling();
        });
  resize?.observe(viewport);
  resize?.observe(track);
  sync();
  return {
    scrolling,
    prepareScroll,
    revealClose,
    revealSelected,
    dispose() {
      alive = false;
      clearTimeout(timer);
      mutations.disconnect();
      resize?.disconnect();
      track.removeAttribute("data-scrolling");
    },
  };
}
