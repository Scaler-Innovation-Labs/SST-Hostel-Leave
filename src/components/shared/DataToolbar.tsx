"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
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
  className?: string;
};

export function DataToolbar({
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filters,
  total,
  className,
}: DataToolbarProps) {
  const showSearch = searchValue !== undefined && onSearchChange !== undefined;
  const hasActiveFilters = useMemo(() => {
    return filters?.some((f) => f.value !== "") ?? false;
  }, [filters]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search + Filters row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {showSearch && (
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {filters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            {filters.map((filter) => (
              <select
                key={filter.key}
                aria-label={filter.label}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      {total !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>
          <span>result{total !== 1 ? "s" : ""} found</span>
          {hasActiveFilters && (
            <span className="text-xs">(filtered)</span>
          )}
        </div>
      )}
    </div>
  );
}
