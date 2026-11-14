import { useState } from "react";

export function useControllable(value, defaultValue, onChange) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value === undefined ? internal : value;
  function update(next) {
    const resolved = typeof next === "function" ? next(current) : next;
    if (value === undefined) setInternal(resolved);
    if (!Object.is(resolved, current)) onChange?.(resolved);
  }
  return [current, update];
}
