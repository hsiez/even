import React, { useCallback, useSyncExternalStore } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";

export function StickyIndicator({ viewportRef }) {
  function moving(event) {
    const indicator = event.currentTarget;
    const track = indicator.closest(".even-workbench-tab-track");
    if (
      event.target === indicator &&
      event.propertyName === "transform" &&
      !track.hasAttribute("data-scrolling")
    )
      track.setAttribute("data-indicator-moving", "");
  }
  function stopped(event) {
    const indicator = event.currentTarget;
    const track = indicator.closest(".even-workbench-tab-track");
    if (event.target === indicator && event.propertyName === "transform")
      track.removeAttribute("data-indicator-moving");
  }
  const subscribe = useCallback(
    (notify) => {
      const viewport = viewportRef.current;
      if (!viewport) return () => {};
      viewport.addEventListener("scroll", notify, { passive: true });
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(notify);
      observer?.observe(viewport);
      return () => {
        viewport.removeEventListener("scroll", notify);
        observer?.disconnect();
      };
    },
    [viewportRef],
  );
  const snapshot = useCallback(() => {
    const viewport = viewportRef.current;
    return viewport
      ? `${viewport.scrollLeft}:${viewport.clientWidth}:${viewport.clientHeight}`
      : "0:0:0";
  }, [viewportRef]);
  const position = useSyncExternalStore(subscribe, snapshot, () => "0:0:0");
  return (
    <BaseTabs.Indicator
      onTransitionRun={moving}
      onTransitionEnd={stopped}
      onTransitionCancel={stopped}
      className="even-workbench-tab-indicator"
      aria-hidden="true"
      data-scroll-position={position}
    />
  );
}
