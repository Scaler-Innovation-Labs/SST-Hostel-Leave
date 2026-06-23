"use client";

import { cn } from "@/lib/utils";

type FilterOption = {
  value: string;
  label: string;
};

type FilterBarProps = {
  label?: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
};

export function FilterBar({ label, options, value, onChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
