import { classes } from "../presentation";
import React from "react";
import { createContext, useContext, useEffect, useId, useRef } from "react";
const Context = createContext(null);
function useInspector() {
  const value = useContext(Context);
  if (!value) throw new Error("Inspector parts require <InspectorPanel>.");
  return value;
}
function Root({
  open = true,
  onClose,
  returnFocusRef,
  label = "Execution inspector",
  children,
  ...props
}) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const previous = returnFocusRef?.current ?? document.activeElement;
    ref.current?.focus();
    const panel = ref.current;
    return () => {
      if (
        panel?.contains(document.activeElement) ||
        document.activeElement === document.body
      )
        previous?.focus?.();
    };
  }, [open, returnFocusRef]);
  if (!open) return null;
  return (
    <Context.Provider value={{ onClose, id }}>
      <aside
        {...props}
        className={classes("even-inspector", props.className)}
        ref={ref}
        tabIndex={-1}
        aria-label={label}
      >
        {children}
      </aside>
    </Context.Provider>
  );
}
function Header(props) {
  useInspector();
  return (
    <header
      {...props}
      className={classes("even-inspector-header", props.className)}
    />
  );
}
function Body(props) {
  useInspector();
  return (
    <div
      {...props}
      className={classes("even-inspector-body", props.className)}
    />
  );
}
function Close({ children = "Close inspector", onClick, ...props }) {
  const { onClose } = useInspector();
  return (
    <button
      {...props}
      className={classes("even-button", props.className)}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onClose?.();
      }}
    >
      {children}
    </button>
  );
}
export const InspectorPanel = Object.assign(Root, { Header, Body, Close });
