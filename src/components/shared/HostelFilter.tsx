"use client";

import { Building2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HostelOption = { id: string; name: string; code: string };

type HostelFilterProps = {
  value: string;
  hostels: HostelOption[] | undefined;
  onChange: (value: string) => void;
  className?: string;
};

/**
 * Hostel selector that degrades to a read-only chip when the caller can
 * only ever see a single hostel (e.g. a HOSTEL-scoped admin). Super admins
 * (or admins scoped to multiple hostels) keep the full dropdown.
 */
export function HostelFilter({ value, hostels, onChange, className }: HostelFilterProps) {
  if (!hostels || hostels.length === 1) {
    const hostel = hostels?.[0];
    return (
      <div
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground ${className ?? ""}`}
        title="Your scope"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-medium">{hostel?.name ?? "All hostels"}</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 w-[160px] ${className ?? ""}`}>
        <SelectValue placeholder="Hostel" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">All Hostels</SelectItem>
        {hostels.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default HostelFilter;