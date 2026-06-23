"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  className?: string;
};

export function SearchBar({
  placeholder = "Search...",
  value: externalValue,
  onChange,
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? "");

  useEffect(() => {
    setInternalValue(externalValue ?? "");
  }, [externalValue]);

  useEffect(() => {
    if (externalValue !== undefined) return;

    const timer = setTimeout(() => {
      onChange(internalValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, externalValue, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    if (externalValue !== undefined) {
      onChange(val);
    }
  };

  return (
    <input
      type="text"
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
        className,
      )}
    />
  );
}
