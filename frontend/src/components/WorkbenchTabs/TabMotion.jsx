import React from "react";
import { readInteractionDelay, readMotionTiming } from "../../tokens/motion";
import { observeMotionInput, isKeyboardMotion } from "../motionInput";
const same = (a, b) =>
  a.length === b.length && a.every((value, i) => value === b[i]);
const containsPoint = (box, event) =>
  box &&
  event.clientX >= box.left &&
  event.clientX <= box.right &&
  event.clientY >= box.top &&
  event.clientY <= box.bottom;

export class TabMotion extends React.Component {
  track = React.createRef();
  motion = null;
  frame = null;
  lastRemovalAt = -Infinity;
  lastCloseRect = null;
  pendingClose = null;

  componentDidMount() {
    const viewport = this.track.current.parentElement;
    this.media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.media?.addEventListener("change", this.stop);
    this.stopObservingInput = observeMotionInput(
      this.track.current.ownerDocument,
    );
    document.addEventListener("keydown", this.stop, true);
    this.resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (
              this.motion &&
              (viewport.clientWidth !== this.motion.viewportWidth ||
                this.track.current.clientWidth !== this.motion.trackWidth ||
                this.track.current.clientHeight !== this.motion.trackHeight)
            )
              this.stop();
          });
    this.resize?.observe(viewport);
    this.resize?.observe(this.track.current);
    viewport.addEventListener("scroll", this.onScroll, { passive: true });
  }

  componentWillUnmount() {
    this.stop(false);
    this.resize?.disconnect();
    this.media?.removeEventListener("change", this.stop);
    this.stopObservingInput();
    document.removeEventListener("keydown", this.stop, true);
    this.track.current?.parentElement.removeEventListener(
      "scroll",
      this.onScroll,
    );
  }

  getSnapshotBeforeUpdate(previous) {
    const { values } = this.props;
    const track = this.track.current;
    const appended =
      values.length === previous.values.length + 1 &&
      previous.values.every((value, i) => value === values[i]);
    const removed =
      values.length === previous.values.length - 1 &&
      same(
        previous.values.filter((value) => values.includes(value)),
        values,
      );
    if (
      (!appended && !removed) ||
      !track.animate ||
      this.media?.matches ||
      isKeyboardMotion(track)
    )
      return null;
    const rows = [...track.querySelectorAll(".even-workbench-tab")];
    const closes = [...track.querySelectorAll(".even-workbench-tab-close")];
    const indicator = track.querySelector(".even-workbench-tab-indicator");
    if (!indicator || indicator.hidden) return null;
    const active = track
      .querySelector(".even-tab[data-active]")
      ?.closest(".even-workbench-tab");
    const continuing = removed && this.motion?.kind === "remove";
    const repeated =
      removed &&
      (continuing ||
        performance.now() - this.lastRemovalAt <
          readInteractionDelay(track, "repeat"));
    return {
      kind: removed ? "remove" : "create",
      repeated,
      rows: new Map(
        rows.map((node) => [
          previous.values[Number(node.dataset.tabColumn) - 1],
          node.getBoundingClientRect(),
        ]),
      ),
      closes: new Map(
        closes.map((node) => [
          previous.values[Number(node.dataset.tabColumn) - 1],
          node.getBoundingClientRect(),
        ]),
      ),
      active: active?.dataset.tabColumn,
      indicator:
        track.hasAttribute("data-removing") && active
          ? active.getBoundingClientRect()
          : indicator.getBoundingClientRect(),
      scrollLeft: track.parentElement.scrollLeft,
    };
  }

  componentDidUpdate(previous, _, snapshot) {
    if (same(previous.values, this.props.values)) return;
    if (snapshot?.kind === "remove") this.lastRemovalAt = performance.now();

    this.stop(!(snapshot?.kind === "remove" && this.motion?.kind === "remove"));

    if (snapshot?.kind === "remove") this.playRemoval(snapshot);
    else if (snapshot)
      this.frame = requestAnimationFrame(() => this.play(snapshot));
  }

  onScroll = () => {
    if (
      this.motion &&
      Math.abs(
        this.track.current.parentElement.scrollLeft - this.motion.scrollLeft,
      ) > 1
    )
      this.stop();
  };

  pauseForPointer = () => {
    if (!this.motion?.animations.length) return;

    this.motion.animations.forEach((animation) => animation.pause());
    document.addEventListener("pointerup", this.endPointer, { once: true });
    document.addEventListener("pointercancel", this.endPointer, { once: true });
  };

  preparePointer = (event) => {
    this.pendingClose = null;
    const track = this.track.current;
    if (
      event.button === 0 &&
      event.pointerType === "mouse" &&
      this.motion?.kind === "remove" &&
      this.motion.animations.length &&
      containsPoint(this.lastCloseRect, event)
    ) {
      const pressed = event.target.closest(".even-workbench-tab-close");
      const rect = this.lastCloseRect;
      const projected = this.motion.closeTargets?.find((target) =>
        containsPoint(target.box, event),
      )?.button;
      const button = projected ?? pressed;
      if (button?.closest(".even-workbench-tab-track") === track) {
        this.pauseForPointer();
        this.pendingClose = { button, rect };
        if (pressed !== button) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
    }
    this.pauseForPointer();
  };

  captureClick = (event) => {
    const close = event.target.closest(".even-workbench-tab-close");
    const pending = this.pendingClose;
    this.pendingClose = null;
    const repeatIntent =
      pending &&
      event.button === 0 &&
      event.detail > 0 &&
      containsPoint(pending.rect, event) &&
      pending.button.isConnected &&
      pending.button.closest(".even-workbench-tab-track") ===
        this.track.current;
    if (repeatIntent && close !== pending.button) {
      event.preventDefault();
      event.stopPropagation();

      pending.button.click();
      this.lastCloseRect = pending.rect;
      return;
    }
    if (close) {
      this.lastCloseRect = repeatIntent
        ? pending.rect
        : close.getBoundingClientRect();
      return;
    }
    this.stop();
  };

  endPointer = () => {
    document.removeEventListener("pointerup", this.endPointer);
    document.removeEventListener("pointercancel", this.endPointer);
    const paused = this.motion;
    if (paused)
      this.frame = requestAnimationFrame(() => {
        this.frame = null;

        if (this.motion === paused)
          paused.animations.forEach((animation) => animation.play());
      });
  };

  stop = (notify = true) => {
    this.pendingClose = null;
    document.removeEventListener("pointerup", this.endPointer);
    document.removeEventListener("pointercancel", this.endPointer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    const motion = this.motion;
    if (!motion) return;
    this.motion = null;
    motion.animations.forEach((animation) => animation.cancel());
    motion.indicator.style.transition = motion.transition;
    this.track.current?.removeAttribute("data-creating");
    this.track.current?.removeAttribute("data-removing");
    if (notify !== false) this.props.onMotionEnd?.(motion.kind);
  };

  playRemoval(snapshot) {
    const track = this.track.current;
    const viewport = track.parentElement;
    const indicator = track.querySelector(".even-workbench-tab-indicator");
    const hold = snapshot.repeated ? 0 : readInteractionDelay(track, "removal");
    const move = readMotionTiming(
      track,
      snapshot.repeated ? "reflow-rapid" : "reflow",
    );
    const total = hold + move.duration;
    if (!total || !indicator) return;
    const transition = indicator.style.transition;
    indicator.style.transition = "none";
    track.setAttribute("data-removing", "");
    const animations = [];
    const view = viewport.getBoundingClientRect();
    const active = track
      .querySelector(".even-tab[data-active]")
      ?.closest(".even-workbench-tab");
    const activeValue =
      active && this.props.values[Number(active.dataset.tabColumn) - 1];
    const activeOld = snapshot.rows.get(activeValue);
    const activeBox = active?.getBoundingClientRect();

    for (const close of track.querySelectorAll(".even-workbench-tab-close")) {
      close.toggleAttribute(
        "data-active-tab",
        close.dataset.tabColumn === active?.dataset.tabColumn,
      );
    }

    const closeTargets = [
      ...track.querySelectorAll(".even-workbench-tab-close"),
    ]
      .map((button) => ({ button, box: button.getBoundingClientRect() }))
      .sort(
        (a, b) =>
          Number(b.button.hasAttribute("data-active-tab")) -
          Number(a.button.hasAttribute("data-active-tab")),
      );

    const activeDx =
      activeOld && activeBox
        ? activeOld.right <= view.left
          ? -activeBox.width
          : activeOld.left >= view.right
            ? activeBox.width
            : activeOld.left - activeBox.left
        : 0;
    for (const node of track.querySelectorAll(
      ".even-workbench-tab, .even-workbench-tab-close",
    )) {
      const value = this.props.values[Number(node.dataset.tabColumn) - 1];
      const old = (
        node.classList.contains("even-workbench-tab")
          ? snapshot.rows
          : snapshot.closes
      ).get(value);
      const box = node.getBoundingClientRect();
      if (
        !old ||
        (value !== activeValue &&
          (Math.max(old.right, box.right) < view.left ||
            Math.min(old.left, box.left) > view.right))
      )
        continue;
      const dx = value === activeValue ? activeDx : old.left - box.left;
      if (Math.abs(dx) < 0.5) continue;
      const animation = node.animate(
        [
          { transform: `translateX(${dx}px)`, offset: 0 },
          {
            transform: `translateX(${dx}px)`,
            offset: hold / total,
            easing: move.easing,
          },
          { transform: "translateX(0px)", offset: 1 },
        ],
        { duration: total },
      );
      animation.id = "even-tab-remove-gap";
      animations.push(animation);
    }
    const motion = {
      kind: "remove",
      animations,
      closeTargets,
      indicator,
      transition,
      viewportWidth: viewport.clientWidth,
      trackWidth: track.clientWidth,
      trackHeight: track.clientHeight,
      scrollLeft: viewport.scrollLeft,
    };
    this.motion = motion;
    Promise.all(
      animations.map((animation) => animation.finished.catch(() => {})),
    ).then(() => {
      if (this.motion === motion) this.stop();
    });
  }

  play(snapshot) {
    this.frame = null;
    const track = this.track.current;
    if (!track || this.media?.matches) return;
    const enter = readMotionTiming(track, "enter");
    const move = readMotionTiming(track, "move");
    const total = enter.duration + move.duration;
    if (!total) return;
    const viewport = track.parentElement;
    const rows = [...track.querySelectorAll(".even-workbench-tab")];
    const added = rows.at(-1);
    const indicator = track.querySelector(".even-workbench-tab-indicator");
    if (
      !added?.querySelector(".even-tab[data-active]") ||
      !indicator ||
      indicator.hidden
    )
      return;
    const addedBox = added.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const origin =
      track
        .closest(".even-workbench-tab-bar")
        .querySelector(".even-workbench-new")
        ?.getBoundingClientRect().left ?? addedBox.right;
    const enteredFrom = Math.max(0, origin - addedBox.left);
    const jumped =
      Math.abs(viewport.scrollLeft - snapshot.scrollLeft) >
      addedBox.width * 1.5;
    const previousActive = rows.find(
      (node) => node.dataset.tabColumn === snapshot.active,
    );
    const previousBox = previousActive?.getBoundingClientRect();
    const anchor =
      previousBox &&
      previousBox.right >= viewportBox.left &&
      previousBox.left < addedBox.left
        ? previousBox
        : { left: addedBox.left - addedBox.width };
    const startLeft = jumped
      ? anchor.left + enteredFrom
      : snapshot.indicator.left;
    const transition = indicator.style.transition;
    indicator.style.transition = "none";
    const finalBox = indicator.getBoundingClientRect();
    const transform = getComputedStyle(indicator).transform;
    const x = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
    const animations = [];
    const animate = (node, frames, duration, id) => {
      const animation = node.animate(frames, {
        duration,
        easing: enter.easing,
      });
      animation.id = id;
      animations.push(animation);
    };
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      if (
        box.right < viewportBox.left - box.width ||
        box.left > viewportBox.right + box.width
      )
        continue;
      const old = snapshot.rows.get(
        this.props.values[Number(row.dataset.tabColumn) - 1],
      );
      const dx =
        row === added
          ? enteredFrom
          : jumped
            ? addedBox.width
            : (old?.left ?? box.left) - box.left;
      animate(
        row,
        [
          {
            transform: `translateX(${dx}px)`,
            opacity: row === added ? 0 : 1,
          },
          {
            transform: "translateX(0px)",
            opacity: 1,
          },
        ],
        enter.duration,
        row === added ? "even-tab-enter" : "even-tab-make-room",
      );
    }
    for (const close of track.querySelectorAll(".even-workbench-tab-close")) {
      const box = close.getBoundingClientRect();
      if (box.right < viewportBox.left || box.left > viewportBox.right)
        continue;
      const old = snapshot.closes.get(
        this.props.values[Number(close.dataset.tabColumn) - 1],
      );
      const dx =
        close.dataset.tabColumn === added.dataset.tabColumn
          ? enteredFrom
          : jumped
            ? addedBox.width
            : (old?.left ?? box.left) - box.left;
      animate(
        close,
        [
          { transform: `translateX(${dx}px)` },
          { transform: "translateX(0px)" },
        ],
        enter.duration,
        "even-tab-close-enter",
      );
    }
    const focus = indicator.animate(
      [
        {
          transform: `translateX(${x + startLeft - finalBox.left}px)`,
          offset: 0,
          easing: enter.easing,
        },
        {
          transform: `translateX(${x + anchor.left - finalBox.left}px)`,
          offset: enter.duration / total,
          easing: move.easing,
        },
        { transform, offset: 1 },
      ],
      { duration: total },
    );
    focus.id = "even-tab-create-focus";
    animations.push(focus);
    const motion = {
      kind: "create",
      animations,
      indicator,
      transition,
      viewportWidth: viewport.clientWidth,
      trackWidth: track.clientWidth,
      trackHeight: track.clientHeight,
      scrollLeft: viewport.scrollLeft,
    };
    this.motion = motion;
    track.setAttribute("data-creating", "");
    Promise.all(
      animations.map((animation) => animation.finished.catch(() => {})),
    ).then(() => {
      if (this.motion === motion) this.stop();
    });
  }

  render() {
    return (
      <div
        ref={this.track}
        className="even-workbench-tab-track"
        style={{ "--even-tab-count": Math.max(1, this.props.values.length) }}
        onPointerDownCapture={this.preparePointer}
        onPointerCancelCapture={() => {
          this.pendingClose = null;
        }}
        onClickCapture={this.captureClick}
        onKeyDownCapture={this.stop}
        onWheelCapture={this.stop}
      >
        {this.props.children}
      </div>
    );
  }
}
