import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Tabs } from "../Tabs/Tabs";
import { Menu } from "../Menu/Menu";
import { IconButton } from "../IconButton/IconButton";
import { classes, styledPart } from "../presentation";
import { TabMotion } from "./TabMotion";
import { useStickyTab } from "./useStickyTab";
import { StickyIndicator } from "./StickyIndicator";
import { iconForTab } from "./tabIcons";

// Base UI owns selection, roving focus, tab/panel relationships and dismissal.
// The host owns tab records and decides which tab replaces a closed one.
function Tab({
  children,
  kind = "traces",
  onClose,
  closeLabel,
  column,
  hovered,
  onHoverEnter,
  onHoverLeave,
  onKeyDown,
  ...props
}) {
  const TypeIcon = iconForTab(kind);
  return (
    <div
      className="even-workbench-tab"
      role="presentation"
      data-closable={!!onClose || undefined}
      data-tab-column={column}
      data-hovered={hovered || undefined}
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
      style={{ gridColumn: column, gridRow: 1 }}
    >
      <Tabs.Trigger
        {...props}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            !event.defaultPrevented &&
            !event.baseUIHandlerPrevented &&
            event.key === "Delete" &&
            onClose
          ) {
            event.preventDefault();
            onClose();
          }
        }}
      >
        {TypeIcon && (
          <TypeIcon
            className="even-workbench-tab-icon"
            aria-hidden="true"
            focusable="false"
          />
        )}
        <span className="even-workbench-tab-label">{children}</span>
      </Tabs.Trigger>
      <span
        aria-hidden="true"
        className="even-workbench-active-fade even-workbench-active-fade-start"
      />
      <span
        aria-hidden="true"
        className="even-workbench-active-fade even-workbench-active-fade-end"
      />
    </div>
  );
}

function List({ children, className, ...props }) {
  const tabs = React.Children.toArray(children);
  const [hovered, setHovered] = useState();
  const [overflow, setOverflow] = useState({ start: false, end: false });
  function enter(value, event) {
    if (event.pointerType !== "touch") setHovered(value);
  }
  function leave(value, column, event) {
    const next = event.relatedTarget?.closest?.("[data-tab-column]");
    // The close button is outside the semantic tablist, but belongs to the
    // same visual item. Crossing between them must retain the item's hover.
    if (
      next?.dataset.tabColumn === String(column) &&
      next.closest(".even-workbench-tab-track") ===
        event.currentTarget.closest(".even-workbench-tab-track")
    )
      return;
    setHovered((current) => (current === value ? undefined : current));
  }
  const scrollRef = useRef(null);
  const updateOverflow = useCallback(() => {
    const viewport = scrollRef.current;
    if (viewport) {
      const next = {
        start: viewport.scrollLeft > 1,
        end:
          viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1,
      };
      setOverflow((current) =>
        current.start === next.start && current.end === next.end
          ? current
          : next,
      );
    }
  }, []);
  useStickyTab(scrollRef, updateOverflow);
  const revealSelected = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport?.clientWidth) return;
    // Entry transforms deliberately extend under the plus. Measure the final
    // layout again on completion rather than scrolling the projected bounds.
    if (viewport.querySelector("[data-creating]")) {
      updateOverflow();
      return;
    }
    const selected = viewport.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    if (selected) {
      const box = viewport.getBoundingClientRect();
      const tab = selected.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const startInset = parseFloat(style.paddingInlineStart) || 0;
      const endInset = parseFloat(style.paddingInlineEnd) || 0;
      if (tab.left < box.left + startInset)
        viewport.scrollLeft += tab.left - box.left - startInset;
      else if (tab.right > box.right - endInset)
        viewport.scrollLeft += tab.right - box.right + endInset;
    }
    updateOverflow();
  }, [updateOverflow]);
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(revealSelected);
    observer?.observe(viewport);
    observer?.observe(viewport.firstElementChild);
    viewport.addEventListener("scroll", updateOverflow, { passive: true });
    updateOverflow();
    return () => {
      observer?.disconnect();
      viewport.removeEventListener("scroll", updateOverflow);
    };
  }, [tabs.length, updateOverflow, revealSelected]);
  return (
    <div className="even-workbench-tab-window">
      <div
        className="even-workbench-tab-scroll"
        ref={scrollRef}
        data-overflow-start={overflow.start || undefined}
        data-overflow-end={overflow.end || undefined}
      >
        <TabMotion
          values={tabs.map((tab) => tab.props.value)}
          onMotionEnd={revealSelected}
        >
          <Tabs.List
            {...props}
            className={classes("even-workbench-tab-list", className)}
          >
            {tabs.map((tab, index) =>
              React.cloneElement(tab, {
                column: index + 1,
                hovered: hovered === tab.props.value,
                onHoverEnter: (event) => enter(tab.props.value, event),
                onHoverLeave: (event) =>
                  leave(tab.props.value, index + 1, event),
              }),
            )}
            <StickyIndicator viewportRef={scrollRef} />
          </Tabs.List>
          {/* Close buttons are semantic siblings of the tablist, with a shared CSS
        grid placing each beside its tab. No nested buttons or extra tab roles. */}
          {tabs.map(
            (tab, index) =>
              tab.props.onClose && (
                <IconButton
                  key={tab.key}
                  className="even-workbench-tab-close"
                  style={{ gridColumn: index + 1, gridRow: 1 }}
                  label={tab.props.closeLabel ?? `Close ${tab.props.children}`}
                  variant="ghost"
                  size="compact"
                  data-tab-column={index + 1}
                  data-tab-hovered={hovered === tab.props.value || undefined}
                  onPointerEnter={(event) => enter(tab.props.value, event)}
                  onPointerLeave={(event) =>
                    leave(tab.props.value, index + 1, event)
                  }
                  onClick={(event) => {
                    setHovered(undefined);
                    tab.props.onClose(event);
                  }}
                >
                  <svg
                    className="even-workbench-close-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m3 3 10 10m0-10L3 13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              ),
          )}
        </TabMotion>
      </div>
    </div>
  );
}

function New({ onCreate, finalFocus, className, ...props }) {
  const created = useRef(false);
  return (
    <Menu
      onOpenChange={(open) => {
        if (open) created.current = false;
      }}
    >
      <Menu.Trigger
        aria-label="New tab"
        data-variant="ghost"
        data-size="compact"
        {...props}
        className={classes("even-workbench-new", className)}
      >
        <svg
          className="even-workbench-add-icon"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </Menu.Trigger>
      <Menu.Content
        align="end"
        aria-label="New workbench tab"
        finalFocus={() => (created.current ? (finalFocus?.() ?? true) : true)}
      >
        <Menu.Item
          onClick={() => {
            created.current = true;
            onCreate("traces");
          }}
        >
          New trace explorer
        </Menu.Item>
        <Menu.Item
          onClick={() => {
            created.current = true;
            onCreate("playground");
          }}
        >
          New chat playground
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}

export const WorkbenchTabs = Object.assign(
  styledPart(Tabs, "even-workbench-tabs"),
  {
    Bar: styledPart("div", "even-workbench-tab-bar"),
    List,
    Tab,
    New,
    Panel: styledPart(Tabs.Panel, "even-workbench-tab-panel"),
  },
);
