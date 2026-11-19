import { TraceIcon, ChatIcon } from "../icons";

// Tab callers use product kinds; vendor aliases live in ../icons.js.
const icons = new Map([
  ["traces", TraceIcon],
  ["playground", ChatIcon],
]);

export const iconForTab = (kind) => icons.get(kind);
