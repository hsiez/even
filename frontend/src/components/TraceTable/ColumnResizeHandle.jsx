import React, { useRef, useState } from "react";

// Internal table control: headers write width state; native columns size all rows.
export function ColumnResizeHandle({ column, tableId, onResize }) {
  const drag = useRef(null);
  const [resizing, setResizing] = useState(false);
  function stop(element) {
    const current = drag.current;
    drag.current = null;
    setResizing(false);
    if (current && element.hasPointerCapture(current.pointerId))
      element.releasePointerCapture(current.pointerId);
  }
  return (
    <div
      className="even-column-resizer"
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${column.label} column`}
      aria-orientation="vertical"
      aria-controls={tableId}
      aria-valuemin={column.min}
      aria-valuemax={column.max}
      aria-valuenow={Math.round(column.width)}
      aria-valuetext={`${Math.round(column.width)} pixels`}
      data-resizing={resizing || undefined}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          width: event.currentTarget.closest("th").getBoundingClientRect()
            .width,
          direction:
            getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        onResize(
          current.width + (event.clientX - current.x) * current.direction,
        );
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId)
          stop(event.currentTarget);
      }}
      onPointerCancel={(event) => stop(event.currentTarget)}
      onLostPointerCapture={() => {
        drag.current = null;
        setResizing(false);
      }}
      onKeyDown={(event) => {
        const direction =
          getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
        const step = event.shiftKey ? 32 : 8;
        const currentWidth =
          event.currentTarget.closest("th").getBoundingClientRect().width ||
          column.width;
        let next;
        if (event.key === "ArrowLeft") next = currentWidth - step * direction;
        if (event.key === "ArrowRight") next = currentWidth + step * direction;
        if (event.key === "Home") next = column.min;
        if (event.key === "End") next = column.max;
        if (event.key === "Escape" && drag.current) {
          next = drag.current.width;
          stop(event.currentTarget);
        }
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onResize(next);
      }}
    />
  );
}
