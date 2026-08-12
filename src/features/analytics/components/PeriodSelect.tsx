"use client";

import { CalendarRange } from "lucide-react";

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
};

export function PeriodSelect({ value, onChange }: PeriodSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="h-4 w-4 text-muted-foreground" />
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
  );
}

export default PeriodSelect;