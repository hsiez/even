import React, {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";

// Re-render just the primitive as the native sticky slot moves. Base UI remains
// responsible for its measured position and size; no parallel indicator engine.
export function StickyIndicator({ viewportRef }) {
  const indicatorRef = useRef(null);
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    const track = indicator.closest(".even-workbench-tab-track");
    const moving = (event) => {
      if (
        event.target === indicator &&
        event.propertyName === "transform" &&
        !track.hasAttribute("data-scrolling")
      )
        track.setAttribute("data-indicator-moving", "");
    };
    const stopped = (event) => {
      if (event.target === indicator && event.propertyName === "transform")
        track.removeAttribute("data-indicator-moving");
    };
    indicator.addEventListener("transitionrun", moving);
    indicator.addEventListener("transitionend", stopped);
    indicator.addEventListener("transitioncancel", stopped);
    return () => {
      indicator.removeEventListener("transitionrun", moving);
      indicator.removeEventListener("transitionend", stopped);
      indicator.removeEventListener("transitioncancel", stopped);
    };
  }, []);
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
      ref={indicatorRef}
      className="even-workbench-tab-indicator"
      aria-hidden="true"
      data-scroll-position={position}
    />
  );
}
