import React from "react";
import { readMotionTiming } from "../../tokens/motion";
import { observeMotionInput, isKeyboardMotion } from "../motionInput";

export class ScopeMotion extends React.Component {
  root = React.createRef();
  overlay = React.createRef();
  animations = [];

  componentDidMount() {
    const node = this.root.current;
    this.media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.media?.addEventListener("change", this.stop);
    this.unobserve = observeMotionInput(node.ownerDocument);
    node.ownerDocument.addEventListener("keydown", this.stop, true);
    let width = node.clientWidth,
      height = node.clientHeight;
    this.resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (width !== node.clientWidth || height !== node.clientHeight)
              this.stop();
            width = node.clientWidth;
            height = node.clientHeight;
          });
    this.resize?.observe(node);
  }

  componentWillUnmount() {
    this.stop();
    this.media?.removeEventListener("change", this.stop);
    this.root.current.ownerDocument.removeEventListener(
      "keydown",
      this.stop,
      true,
    );
    this.resize?.disconnect();
    this.unobserve?.();
  }

  stop = () => {
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
    this.overlay.current?.replaceChildren();
    this.root.current?.removeAttribute("data-scope-transition");
  };

  getSnapshotBeforeUpdate(previous) {
    if (previous.scopeId === this.props.scopeId) return null;
    this.stop();
    const root = this.root.current;
    if (!root.animate || isKeyboardMotion(root)) return null;
    const panels = [...root.querySelectorAll("[data-trace-surface]")];
    return panels.map((node) => {
      const clone = node.cloneNode(true);

      for (const item of [clone, ...clone.querySelectorAll("*")]) {
        for (const name of [
          "id",
          "aria-owns",
          "aria-labelledby",
          "aria-describedby",
          "data-trace-surface",
        ])
          item.removeAttribute(name);
        if (item.matches("button, input, select, textarea, a, [tabindex]"))
          item.setAttribute("tabindex", "-1");
      }
      clone.setAttribute("aria-hidden", "true");
      clone.inert = true;
      Object.assign(clone.style, {
        position: "absolute",
        margin: "0",
        boxSizing: "border-box",
        left: `${node.offsetLeft}px`,
        top: `${node.offsetTop}px`,
        width: `${node.offsetWidth}px`,
        height: `${node.offsetHeight}px`,
      });
      return {
        clone,
        scroll: [node, ...node.querySelectorAll("*")].map((item) => [
          item.scrollLeft,
          item.scrollTop,
        ]),
      };
    });
  }

  componentDidUpdate(previous, _, snapshot) {
    if (!snapshot?.length) return;
    const root = this.root.current;
    const reduced = this.media?.matches;
    const timing = readMotionTiming(root, reduced ? "reduced" : "move-large");
    if (!timing.duration) return;

    const probe = root.ownerDocument.createElement("div");
    probe.style.cssText =
      "position:absolute;width:var(--even-space-gap-group);visibility:hidden";
    root.append(probe);
    const distance = reduced ? 0 : probe.getBoundingClientRect().width;
    probe.remove();
    const forward = this.props.depth > previous.depth;
    const travel = forward ? distance : -distance;
    root.setAttribute("data-scope-transition", forward ? "forward" : "back");
    for (const { clone, scroll } of snapshot) {
      this.overlay.current.append(clone);
      [clone, ...clone.querySelectorAll("*")].forEach((node, index) => {
        [node.scrollLeft, node.scrollTop] = scroll[index];
      });
      this.animations.push(
        clone.animate(
          [
            { opacity: 1, transform: "translateX(0px)" },
            { opacity: 0, transform: `translateX(${-travel}px)`, offset: 0.35 },
            { opacity: 0, transform: `translateX(${-travel}px)` },
          ],
          { ...timing, fill: "both" },
        ),
      );
    }
    for (const panel of root.querySelectorAll("[data-trace-surface]")) {
      this.animations.push(
        panel.animate(
          [
            { opacity: 0, transform: `translateX(${travel}px)` },
            { opacity: 0, transform: `translateX(${travel}px)`, offset: 0.35 },
            { opacity: 1, transform: "translateX(0px)" },
          ],
          { ...timing, fill: "both" },
        ),
      );
    }
    const current = this.animations;
    Promise.all(current.map((animation) => animation.finished))
      .then(() => {
        if (this.animations === current) this.stop();
      })
      .catch(() => {});
  }

  render() {
    const { scopeId, depth, elementRef, children, ...props } = this.props;
    return (
      <section
        {...props}
        ref={(node) => {
          this.root.current = node;
          if (typeof elementRef === "function") elementRef(node);
          else if (elementRef) elementRef.current = node;
        }}
      >
        {children}
        <div
          className="even-trace-scope-snapshot"
          ref={this.overlay}
          aria-hidden="true"
          inert
        />
      </section>
    );
  }
}
