import React from "react";
export function Duration({ milliseconds }) {
  if (
    milliseconds == null ||
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  )
    return <span>Unknown duration</span>;
  return (
    <span>
      {milliseconds < 1000
        ? `${Math.round(milliseconds)} ms`
        : `${(milliseconds / 1000).toFixed(2)} s`}
    </span>
  );
}
