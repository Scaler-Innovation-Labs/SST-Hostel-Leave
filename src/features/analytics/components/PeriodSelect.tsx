"use client";

import { CalendarRange } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANALYTICS_PERIOD_OPTIONS, type AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";

type PeriodSelectProps = {
  value: AnalyticsPeriod;
  onChange: (value: AnalyticsPeriod) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
};

export function PeriodSelect({
  value,
  onChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: PeriodSelectProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 shrink-0 text-muted" />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {ANALYTICS_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Start date"
            className="h-9 w-36 text-caption"
            value={startDate ?? ""}
            onChange={(e) => onStartDateChange?.(e.target.value)}
          />
          <span className="text-caption text-muted">to</span>
          <Input
            type="date"
            aria-label="End date"
            className="h-9 w-36 text-caption"
            value={endDate ?? ""}
            onChange={(e) => onEndDateChange?.(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default PeriodSelect;
