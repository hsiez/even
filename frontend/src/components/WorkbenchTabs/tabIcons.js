import { TraceIcon, ChatIcon } from "../icons";

const icons = new Map([
  ["traces", TraceIcon],
  ["playground", ChatIcon],
]);

export const iconForTab = (kind) => icons.get(kind);
