import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Tabs } from "../Tabs/Tabs";
import { Menu } from "../Menu/Menu";
import { IconButton } from "../IconButton/IconButton";
import { classes, styledPart } from "../presentation";
import { TabMotion } from "./TabMotion";
import { useStickyTab } from "./useStickyTab";
import { StickyIndicator } from "./StickyIndicator";
import { iconForTab } from "./tabIcons";
import { AddIcon, CloseIcon } from "../icons";

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
  const scrollRef = useRef(null);
  const pointer = useRef(null);
  function updateHover(event) {
    if (event?.pointerType === "touch") return;
    if (event) pointer.current = { x: event.clientX, y: event.clientY };
    const viewport = scrollRef.current;
    const track = viewport?.firstElementChild;
    let next;
    if (
      pointer.current &&
      track &&
      !track.matches("[data-creating], [data-removing], [data-scrolling]")
    ) {
      const hit =
        viewport.ownerDocument.elementFromPoint?.(
          pointer.current.x,
          pointer.current.y,
        ) ??
        (event?.type === "pointerleave" ? event.relatedTarget : event?.target);
      const part = hit?.closest?.("[data-tab-column]");
      if (part?.closest(".even-workbench-tab-track") === track) {
        const value = tabs[Number(part.dataset.tabColumn) - 1]?.props.value;
        if (value !== undefined)
          next = {
            value,
            close: part.classList.contains("even-workbench-tab-close"),
          };
      }
    }
    setHovered((current) =>
      current?.value === next?.value && current?.close === next?.close
        ? current
        : next,
    );
  }
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
  useStickyTab(scrollRef, updateOverflow, updateHover);
  const revealSelected = useCallback(
    (logical = false) => {
      const viewport = scrollRef.current;
      if (!viewport?.clientWidth) return;
      // Entry transforms deliberately extend under the plus. Measure the final
      // layout again on completion rather than scrolling the projected bounds.
      if (viewport.querySelector("[data-creating], [data-removing]")) {
        updateOverflow();
        return;
      }
      const selected = viewport.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      if (selected) {
        const box = viewport.getBoundingClientRect();
        const track = viewport.firstElementChild;
        const row = selected.closest(".even-workbench-tab");
        const width = track.clientWidth / tabs.length;
        const left =
          track.getBoundingClientRect().left +
          (Number(row.dataset.tabColumn) - 1) * width;
        const tab = logical
          ? { left, right: left + width }
          : selected.getBoundingClientRect();
        const style = getComputedStyle(viewport);
        const startInset = parseFloat(style.paddingInlineStart) || 0;
        const endInset = parseFloat(style.paddingInlineEnd) || 0;
        if (tab.left < box.left + startInset)
          viewport.scrollLeft += tab.left - box.left - startInset;
        else if (tab.right > box.right - endInset)
          viewport.scrollLeft += tab.right - box.right + endInset;
      }
      updateOverflow();
    },
    [updateOverflow, tabs.length],
  );
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => revealSelected(true));
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
        onPointerMoveCapture={updateHover}
        onPointerLeave={updateHover}
      >
        <TabMotion
          values={tabs.map((tab) => tab.props.value)}
          onMotionEnd={(kind) => {
            revealSelected(kind === "create");
            updateHover();
          }}
        >
          <Tabs.List
            {...props}
            className={classes("even-workbench-tab-list", className)}
          >
            {tabs.map((tab, index) =>
              React.cloneElement(tab, {
                column: index + 1,
                hovered: hovered?.value === tab.props.value,
                onHoverEnter: updateHover,
                onHoverLeave: updateHover,
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
                  data-tab-hovered={
                    hovered?.value === tab.props.value || undefined
                  }
                  data-close-hovered={
                    (hovered?.value === tab.props.value && hovered.close) ||
                    undefined
                  }
                  onPointerEnter={updateHover}
                  onPointerLeave={updateHover}
                  onClick={(event) => {
                    setHovered(undefined);
                    tab.props.onClose(event);
                  }}
                >
                  <CloseIcon
                    className="even-workbench-close-icon"
                    aria-hidden="true"
                    focusable="false"
                  />
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
        <AddIcon
          className="even-workbench-add-icon"
          aria-hidden="true"
          focusable="false"
        />
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
