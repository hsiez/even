import "../components.css";
import React from "react";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button/Button";
import { FilterBar } from "../FilterBar/FilterBar";
export function TraceToolbar({
  query = "",
  onQueryChange,
  filters = [],
  onRemoveFilter,
  onClearFilters,
  onRefresh,
  refreshing = false,
  children,
}) {
  return (
    <section className="even-trace-toolbar" aria-label="Trace controls">
      <TextField
        label="Search traces"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <Button disabled={!query} onClick={() => onQueryChange("")}>
        Clear search
      </Button>
      <Button pending={refreshing} onClick={onRefresh}>
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
      {children}
      <FilterBar
        filters={filters}
        onRemove={onRemoveFilter}
        onClear={onClearFilters}
      />
    </section>
  );
}
