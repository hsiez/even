import React, { useCallback, useRef, useState } from "react";
import { Tabs } from "../Tabs/Tabs";
import { Menu } from "../Menu/Menu";
import { IconButton } from "../IconButton/IconButton";
import { classes, styledPart } from "../presentation";
import { TabMotion } from "./TabMotion";
import { observeTabViewport } from "./tabViewport";
import { StickyIndicator } from "./StickyIndicator";
import { iconForTab } from "./tabIcons";
import { AddIcon, CloseIcon } from "../icons";

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
  const controller = useRef(null);
  const updateHover = useCallback((event) => {
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
        const column = Number(part.dataset.tabColumn);
        if (column > 0)
          next = {
            column,
            close: part.classList.contains("even-workbench-tab-close"),
          };
      }
    }
    setHovered((current) =>
      current?.column === next?.column && current?.close === next?.close
        ? current
        : next,
    );
  }, []);
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
  const attachViewport = useCallback(
    (viewport) => {
      if (!viewport) return;
      scrollRef.current = viewport;
      const owner = observeTabViewport(viewport, updateOverflow, updateHover);
      controller.current = owner;
      return () => {
        owner.dispose();
        if (controller.current === owner) {
          controller.current = null;
          scrollRef.current = null;
        }
      };
    },
    [updateOverflow, updateHover],
  );
  return (
    <div className="even-workbench-tab-window">
      <div
        className="even-workbench-tab-scroll"
        ref={attachViewport}
        data-overflow-start={overflow.start || undefined}
        data-overflow-end={overflow.end || undefined}
        onScroll={() => controller.current?.scrolling()}
        onWheelCapture={(event) => controller.current?.prepareScroll(event)}
        onTouchMoveCapture={(event) => controller.current?.prepareScroll(event)}
        onFocusCapture={(event) => controller.current?.revealClose(event)}
        onPointerMoveCapture={updateHover}
        onPointerLeave={updateHover}
      >
        <TabMotion
          values={tabs.map((tab) => tab.props.value)}
          onMotionEnd={(kind) => {
            controller.current?.revealSelected(kind === "create");
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
                hovered: hovered?.column === index + 1,
                onHoverEnter: updateHover,
                onHoverLeave: updateHover,
              }),
            )}
            <StickyIndicator viewportRef={scrollRef} />
          </Tabs.List>
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
                  data-tab-hovered={hovered?.column === index + 1 || undefined}
                  data-close-hovered={
                    (hovered?.column === index + 1 && hovered.close) ||
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
