"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Input } from "@/design-system/sst";
import { cn } from "@/lib/utils";

export type ToolbarFilter = {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
};

type DataToolbarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: ToolbarFilter[];
  total?: number;
  /** What is being counted, so the result line reads as a sentence. */
  noun?: string;
  className?: string;
};

export function DataToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  filters,
  total,
  noun = "result",
  className,
}: DataToolbarProps) {
  const showSearch = searchValue !== undefined && onSearchChange !== undefined;
  const hasActiveFilters = useMemo(
    () => filters?.some((filter) => filter.value !== "") ?? false,
    [filters]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showSearch && (
          <div className="relative flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {filters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal
              className="h-4 w-4 shrink-0 text-muted"
              aria-hidden
            />
            {filters.map((filter) => (
              <select
                key={filter.key}
                aria-label={filter.label}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                className={cn(
                  "h-10 rounded-md border border-border bg-surface-sunken px-3 text-body text-ink",
                  "transition-colors duration-fast ease-standard",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                )}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
      </div>

      {total !== undefined && (
        <p
          aria-live="polite"
          className="font-mono text-micro uppercase tracking-wider text-muted"
        >
          <span className="tabular-nums text-ink">{total}</span>{" "}
          {noun}
          {total === 1 ? "" : "s"}
          {hasActiveFilters ? " matching your filters" : ""}
        </p>
      )}
    </div>
  );
}
