import { afterEach, expect, test, vi } from "vitest";
import { observeTabViewport } from "./tabViewport";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function observerStub() {
  const instances = [];
  class Observer {
    constructor(notify) {
      this.notify = notify;
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      instances.push(this);
    }
  }
  return { Observer, instances };
}

test("one viewport owner releases observers and idle work, including already queued notifications", () => {
  vi.useFakeTimers();
  const mutations = observerStub();
  const resizes = observerStub();
  vi.stubGlobal("MutationObserver", mutations.Observer);
  vi.stubGlobal("ResizeObserver", resizes.Observer);
  const viewport = document.createElement("div");
  const track = document.createElement("div");
  viewport.append(track);
  Object.defineProperty(viewport, "clientWidth", { value: 300 });
  Object.defineProperty(viewport, "scrollWidth", { value: 900 });
  const overflow = vi.fn();
  const idle = vi.fn();
  const owner = observeTabViewport(viewport, overflow, idle);
  expect(mutations.instances).toHaveLength(1);
  expect(resizes.instances).toHaveLength(1);
  expect(resizes.instances[0].observe.mock.calls).toEqual([
    [viewport],
    [track],
  ]);
  owner.prepareScroll({ type: "wheel", deltaX: -10 });
  expect(track).not.toHaveAttribute("data-scrolling");
  owner.prepareScroll({ type: "wheel", deltaX: 10 });
  expect(track).toHaveAttribute("data-scrolling");
  vi.advanceTimersByTime(120);
  expect(track).not.toHaveAttribute("data-scrolling");
  expect(idle).toHaveBeenCalledOnce();
  owner.scrolling();
  owner.dispose();
  expect(mutations.instances[0].disconnect).toHaveBeenCalledOnce();
  expect(resizes.instances[0].disconnect).toHaveBeenCalledOnce();
  expect(track).not.toHaveAttribute("data-scrolling");
  overflow.mockClear();
  mutations.instances[0].notify();
  resizes.instances[0].notify();
  vi.runAllTimers();
  expect(overflow).not.toHaveBeenCalled();
  expect(idle).toHaveBeenCalledOnce();
  expect(track).not.toHaveAttribute("data-scrolling");
});
