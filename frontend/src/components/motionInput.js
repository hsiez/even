import { useEffect } from "react";

const documents = new WeakMap();
const attribute = "data-even-motion-input";

export function isKeyboardMotion(element) {
  return (
    element.ownerDocument.documentElement.getAttribute(attribute) === "keyboard"
  );
}

export function observeMotionInput(document) {
  let entry = documents.get(document);
  if (!entry) {
    const root = document.documentElement;
    const previous = root.getAttribute(attribute);
    const keyboard = (event) => {
      if (
        !["Shift", "Control", "Alt", "Meta"].includes(event.key) &&
        root.getAttribute(attribute) !== "keyboard"
      )
        root.setAttribute(attribute, "keyboard");
    };
    const pointer = () => {
      if (root.getAttribute(attribute) === "keyboard")
        root.removeAttribute(attribute);
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    entry = {
      count: 0,
      cleanup: () => {
        document.removeEventListener("keydown", keyboard, true);
        document.removeEventListener("pointerdown", pointer, true);
        if (previous === null) root.removeAttribute(attribute);
        else root.setAttribute(attribute, previous);
      },
    };
    documents.set(document, entry);
  }
  entry.count++;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (--entry.count === 0) {
      entry.cleanup();
      documents.delete(document);
    }
  };
}

export function useMotionInput() {
  useEffect(() => observeMotionInput(document), []);
}
