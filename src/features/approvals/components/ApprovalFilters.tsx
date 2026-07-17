"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterState = {
  status: string;
  search: string;
  leaveTypeId: string;
  hostelId: string;
  workflowId: string;
  parentPending: string;
  overdue: string;
  dateRange: string;
};

const DEFAULT_FILTERS: FilterState = {
  status: "",
  search: "",
  leaveTypeId: "",
  hostelId: "",
  workflowId: "",
  parentPending: "",
  overdue: "",
  dateRange: "",
};

type ApprovalFiltersProps = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  leaveTypes?: Array<{ id: string; name: string }>;
  hostels?: Array<{ id: string; name: string; code: string }>;
  workflows?: Array<{ id: string; name: string }>;
  className?: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: LEAVE_APPROVAL_DECISION.PENDING, label: "Pending" },
  { value: LEAVE_APPROVAL_DECISION.APPROVED, label: "Approved" },
  { value: LEAVE_APPROVAL_DECISION.REJECTED, label: "Rejected" },
  { value: LEAVE_APPROVAL_DECISION.AUTO_APPROVED, label: "Auto Approved" },
];

const PARENT_OPTIONS = [
  { value: "", label: "Parent Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "not_required", label: "Not Required" },
];

const OVERDUE_OPTIONS = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue Only" },
  { value: "normal", label: "Normal Only" },
];

const DATE_OPTIONS = [
  { value: "", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function ApprovalFilters({
  filters,
  onFiltersChange,
  leaveTypes = [],
  hostels = [],
  workflows = [],
  className,
}: ApprovalFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search + quick filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or request number..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-9 pl-9"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter("search", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filters.status}
            onValueChange={(v) => updateFilter("status", v)}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.dateRange}
            onValueChange={(v) => updateFilter("dateRange", v)}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "gap-2",
              showAdvanced && "bg-muted",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Select
            value={filters.leaveTypeId}
            onValueChange={(v) => updateFilter("leaveTypeId", v)}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Leave Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {leaveTypes.map((lt) => (
                <SelectItem key={lt.id} value={lt.id}>
                  {lt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hostels.length > 0 && (
            <Select
              value={filters.hostelId}
              onValueChange={(v) => updateFilter("hostelId", v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
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
          )}

          {workflows.length > 0 && (
            <Select
              value={filters.workflowId}
              onValueChange={(v) => updateFilter("workflowId", v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Workflows</SelectItem>
                {workflows.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={filters.parentPending}
            onValueChange={(v) => updateFilter("parentPending", v)}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Parent Status" />
            </SelectTrigger>
            <SelectContent>
              {PARENT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.overdue}
            onValueChange={(v) => updateFilter("overdue", v)}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Overdue" />
            </SelectTrigger>
            <SelectContent>
              {OVERDUE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
