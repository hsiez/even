import "../components.css";
import React from "react";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { RefreshIcon } from "../icons";
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
  searchControl,
}) {
  return (
    <section className="even-trace-toolbar" aria-label="Trace controls">
      {searchControl ?? (
        <>
          <TextField
            label="Search traces"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <Button disabled={!query} onClick={() => onQueryChange("")}>
            Clear search
          </Button>
        </>
      )}
      {(onRefresh || refreshing) && (
        <IconButton
          label="Refresh"
          title={refreshing ? "Refreshing…" : "Refresh"}
          pending={refreshing}
          onClick={onRefresh}
        >
          <RefreshIcon size="100%" aria-hidden="true" focusable="false" />
        </IconButton>
      )}
      {children}
      <FilterBar
        filters={filters}
        onRemove={onRemoveFilter}
        onClear={onClearFilters}
      />
    </section>
  );
}
