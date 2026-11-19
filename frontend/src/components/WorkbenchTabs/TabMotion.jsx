import React from "react";
import { readMotionTiming } from "../../tokens/motion";
import { observeMotionInput, isKeyboardMotion } from "../motionInput";
const same = (a, b) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

// A pre-commit snapshot is needed for FLIP: an effect would see the new layout.
// This coordinates decoration only; Base UI still owns selection and geometry.
export class TabMotion extends React.Component {
  track = React.createRef();
  motion = null;
  frame = null;

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
    if (
      !appended ||
      !track.animate ||
      this.media?.matches ||
      isKeyboardMotion(track)
    )
      return null;
    const rows = [...track.querySelectorAll(".even-workbench-tab")];
    const closes = [...track.querySelectorAll(".even-workbench-tab-close")];
    const indicator = track.querySelector(".even-workbench-tab-indicator");
    if (!indicator || indicator.hidden) return null;
    return {
      rows: new Map(
        rows.map((node) => [
          node.dataset.tabColumn,
          node.getBoundingClientRect(),
        ]),
      ),
      closes: new Map(
        closes.map((node) => [
          node.dataset.tabColumn,
          node.getBoundingClientRect(),
        ]),
      ),
      active: track
        .querySelector(".even-tab[data-active]")
        ?.closest(".even-workbench-tab").dataset.tabColumn,
      indicator: indicator.getBoundingClientRect(),
      scrollLeft: track.parentElement.scrollLeft,
    };
  }

  componentDidUpdate(previous, _, snapshot) {
    if (same(previous.values, this.props.values)) return;
    this.stop();
    if (snapshot) this.frame = requestAnimationFrame(() => this.play(snapshot));
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
    if (!this.motion) return;
    // Keep a moving close button under the pointer until its click is dispatched.
    this.motion.animations.forEach((animation) => animation.pause());
    document.addEventListener("pointerup", this.endPointer, { once: true });
    document.addEventListener("pointercancel", this.endPointer, { once: true });
  };

  endPointer = () => {
    document.removeEventListener("pointerup", this.endPointer);
    document.removeEventListener("pointercancel", this.endPointer);
    if (this.motion) this.frame = requestAnimationFrame(() => this.stop());
  };

  stop = (notify = true) => {
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
    if (notify !== false) this.props.onMotionEnd?.();
  };

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
      const old = snapshot.rows.get(row.dataset.tabColumn);
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
      const old = snapshot.closes.get(close.dataset.tabColumn);
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
        onPointerDownCapture={this.pauseForPointer}
        onClickCapture={this.stop}
        onKeyDownCapture={this.stop}
        onWheelCapture={this.stop}
      >
        {this.props.children}
      </div>
    );
  }
}
