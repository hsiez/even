import React from "react";
export function Timestamp({ value, timeZone = "UTC", locale = "en-US" }) {
  const date = value == null ? null : new Date(value);
  if (!date || !Number.isFinite(date.getTime()))
    return <span>Unknown time</span>;
  const full = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone,
  }).format(date);
  return (
    <time dateTime={date.toISOString()} title={full}>
      {full}
    </time>
  );
}
