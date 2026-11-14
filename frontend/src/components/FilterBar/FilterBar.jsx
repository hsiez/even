import "../components.css";
import React from "react";
import { Button } from "../Button/Button";
export function FilterBar({ filters, onRemove, onClear }) {
  if (!filters.length) return null;
  return (
    <section className="even-filter-bar" aria-label="Active filters">
      <ul>
        {filters.map((filter) => (
          <li key={filter.id}>
            {filter.label}
            <Button
              aria-label={`Remove ${filter.label} filter`}
              onClick={() => onRemove(filter.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button onClick={onClear}>Clear all filters</Button>
    </section>
  );
}
