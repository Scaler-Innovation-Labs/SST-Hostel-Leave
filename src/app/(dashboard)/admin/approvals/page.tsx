"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

const OVERDUE_LIMIT = 200;

import { Building2, CheckCircle2, Clock, FileText, Search, Shield, User, X } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApprovalCommandCard } from "@/features/approvals/components/ApprovalCommandCard";
import { computeDateRange, DATE_RANGE_OPTIONS } from "@/lib/date-utils";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY, WORKFLOW_STEP_KEY, WORKFLOW_STEP_KEYS } from "@/constants/workflow/workflow-step-key";
import { cn } from "@/lib/utils";

// ── Step display mapping ──
// Maps DB step keys to human-readable labels and icons.
type StepDisplay = {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgClass: string;
};

function getStepDisplay(stepKey: string | null): StepDisplay {
  const key = stepKey ?? "";
  if (key === "" || key === VIEW_STEP_KEY.SUBMITTED || key === VIEW_STEP_KEY.POLICY)
    return {
      icon: <FileText className="h-4 w-4" />,
      label: "Policy Check",
      color: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-200/40 dark:border-blue-800/30",
    };
  if (key === WORKFLOW_STEP_KEY.PARENT_APPROVAL || key.includes(WORKFLOW_STEP_KEY.PARENT_APPROVAL))
    return {
      icon: <User className="h-4 w-4" />,
      label: "Parent Approval",
      color: "text-violet-600 dark:text-violet-400",
      bgClass: "bg-violet-500/10 hover:bg-violet-500/20 border-violet-200/40 dark:border-violet-800/30",
    };
  if (key === WORKFLOW_STEP_KEY.POC_APPROVAL || key.includes(WORKFLOW_STEP_KEY.POC_APPROVAL))
    return {
      icon: <Shield className="h-4 w-4" />,
      label: "Hostel Approval",
      color: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-200/40 dark:border-amber-800/30",
    };
  if (key === WORKFLOW_STEP_KEY.ADMIN_APPROVAL || key.includes(WORKFLOW_STEP_KEY.ADMIN_APPROVAL))
    return {
      icon: <Building2 className="h-4 w-4" />,
      label: "College Approval",
      color: "text-indigo-600 dark:text-indigo-400",
      bgClass: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-200/40 dark:border-indigo-800/30",
    };
  if (key === VIEW_STEP_KEY.COMPLETE || key.includes(VIEW_STEP_KEY.COMPLETE))
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Completed",
      color: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-200/40 dark:border-emerald-800/30",
    };
  // Fallback: clean up snake_case key
  const fallbackLabel = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    icon: <Clock className="h-4 w-4" />,
    label: fallbackLabel || "Unknown",
    color: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-muted hover:bg-accent border-border",
  };
}

// Derive the display label for a step key (used in Waiting On filter)
function stepKeyToFilterLabel(stepKey: string): string {
  if (stepKey === "") return "All Status";
  if (stepKey === VIEW_STEP_KEY.COMPLETE) return "Completed";
  return getStepDisplay(stepKey).label;
}

const OVERDUE_HOURS = 24;

type FilterState = {
  status: string;
  waitingOn: string;
  leaveTypeId: string;
  hostelId: string;
  dateRange: string;
  search: string;
};

export default function AdminApprovalsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    status: "",
    waitingOn: "",
    leaveTypeId: "",
    hostelId: "",
    dateRange: "",
    search: "",
  });

  const { leaveTypes } = useLeaveTypes();
  const { data: hostels } = useSWR<Array<{ id: string; name: string; code: string }>>("/api/v1/hostels", fetcher);

  // Derive API-ready date range from the friendly range label
  const dateRange = useMemo(() => computeDateRange(filters.dateRange), [filters.dateRange]);

  const isOverdue = filters.status === "OVERDUE";

  const { approvals, total, totalPages, isLoading, mutate } = useApprovals({
    page: isOverdue ? 1 : page,
    limit: isOverdue ? OVERDUE_LIMIT : 20,
    status: isOverdue ? LEAVE_REQUEST_STATUS.PENDING : filters.status || undefined,
    search: filters.search || undefined,
    waitingOn: isOverdue ? undefined : filters.waitingOn || undefined,
    hostelId: filters.hostelId || undefined,
    leaveTypeId: filters.leaveTypeId || undefined,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  });

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: "", waitingOn: "", leaveTypeId: "", hostelId: "", dateRange: "", search: "" });
    setPage(1);
  };

  // ── Client-side filtering (only for concepts the API doesn't support) ──
  const filteredApprovals = useMemo(() => {
    let items = approvals;

    // overdue filter — no server-side equivalent, must be client-side
    if (filters.status === "OVERDUE") {
      items = items.filter((a) => {
        if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) return false;
        const created = new Date(a.createdAt);
        const hoursSince = (Date.now() - created.getTime()) / (1000 * 60 * 60);
        return hoursSince > OVERDUE_HOURS;
      });
    }

    // Apply waitingOn filter client-side when in Overdue mode
    if (filters.status === "OVERDUE" && filters.waitingOn) {
      items = items.filter((a) => {
        const key = a.stepKey || VIEW_STEP_KEY.POLICY;
        return key === filters.waitingOn;
      });
    }

    return items;
  }, [approvals, filters.status, filters.waitingOn]);

  // ── Step grouping for top cards ──
  const stepGroups = useMemo(() => {
    const groups = new Map<string, { count: number; stepKey: string }>();
    for (const a of filteredApprovals) {
      if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) continue;
      const key = a.stepKey || VIEW_STEP_KEY.POLICY;
      const existing = groups.get(key) ?? { count: 0, stepKey: key };
      existing.count++;
      groups.set(key, existing);
    }
    // Sort by deterministic step order using WORKFLOW_STEP_KEYS constant
    const stepOrder = [VIEW_STEP_KEY.POLICY, ...WORKFLOW_STEP_KEYS];
    return Array.from(groups.entries())
      .map(([, g]) => g)
      .sort((a, b) => {
        const aIdx = stepOrder.indexOf(a.stepKey as typeof stepOrder[number]);
        const bIdx = stepOrder.indexOf(b.stepKey as typeof stepOrder[number]);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
  }, [filteredApprovals]);

  const overdueCount = useMemo(
    () =>
      filteredApprovals.filter((a) => {
        if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) return false;
        const created = new Date(a.createdAt);
        return (Date.now() - created.getTime()) / (1000 * 60 * 60) > OVERDUE_HOURS;
      }).length,
    [filteredApprovals],
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Build the set of active step keys for the Waiting On filter options
  const activeStepKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of filteredApprovals) {
      if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) continue;
      const key = a.stepKey || VIEW_STEP_KEY.POLICY;
      keys.add(key);
    }
    return keys;
  }, [filteredApprovals]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Approvals"
        description={isOverdue
          ? `${filteredApprovals.length} overdue of ${approvals.length} pending`
          : `${filteredApprovals.length} request${filteredApprovals.length !== 1 ? "s" : ""}${hasActiveFilters ? " (filtered)" : ""}`
        }
      />

      {/* Step cards — dynamic workflow step counts */}
      <div className="flex flex-wrap gap-3">
        {stepGroups.map((g) => {
          const display = getStepDisplay(g.stepKey);
          const isActive = filters.waitingOn === g.stepKey;
          return (
            <button
              key={g.stepKey}
              type="button"
              onClick={() => {
                if (isOverdue) {
                  setFilters((prev) => ({ ...prev, status: "", waitingOn: g.stepKey }));
                  setPage(1);
                } else {
                  updateFilter("waitingOn", isActive ? "" : g.stepKey);
                }
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                display.bgClass,
                isActive && "ring-2 ring-primary/40",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  display.color,
                  "bg-background/60",
                )}
              >
                {display.icon}
              </div>
              <div>
                <div className={cn("text-sm font-semibold", display.color)}>
                  {display.label}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {g.count}
                </div>
              </div>
            </button>
          );
        })}
        {overdueCount > 0 && (
          <button
            type="button"
            onClick={() => {
              if (filters.status === "OVERDUE") {
                updateFilter("status", "");
              } else {
                setPage(1);
                setFilters((prev) => ({ ...prev, status: "OVERDUE", waitingOn: "" }));
              }
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-red-200/40 px-4 py-3 text-left transition-all",
              "bg-red-500/10 hover:bg-red-500/20",
              filters.status === "OVERDUE" && "ring-2 ring-red-400/40",
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-red-600 dark:text-red-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                Overdue
              </div>
              <div className="text-2xl font-bold tabular-nums">{overdueCount}</div>
            </div>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll, or request ID..."
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

        <Select
          value={filters.waitingOn}
          onValueChange={(v) => updateFilter("waitingOn", v)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Waiting On" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Steps</SelectItem>
            {Array.from(activeStepKeys).map((key) => (
              <SelectItem key={key} value={key}>
                {stepKeyToFilterLabel(key)}
              </SelectItem>
            ))}
            <SelectItem value={VIEW_STEP_KEY.COMPLETE}>Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => updateFilter("status", v)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value={LEAVE_REQUEST_STATUS.PENDING}>Pending</SelectItem>
            <SelectItem value={LEAVE_REQUEST_STATUS.APPROVED}>Approved</SelectItem>
            <SelectItem value={LEAVE_REQUEST_STATUS.REJECTED}>Rejected</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.leaveTypeId}
          onValueChange={(v) => updateFilter("leaveTypeId", v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Leave Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            {leaveTypes.map((lt: any) => (
              <SelectItem key={lt.id} value={lt.id}>
                {lt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.hostelId}
          onValueChange={(v) => updateFilter("hostelId", v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Hostel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Hostels</SelectItem>
            {hostels?.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.dateRange}
          onValueChange={(v) => updateFilter("dateRange", v)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">
            {filteredApprovals.length}
          </span>{" "}
          of{" "}
          <span className="font-medium text-foreground">{total}</span> request
          {total !== 1 ? "s" : ""}
          {hasActiveFilters && <span> (filtered)</span>}
        </span>
        {!isOverdue && <span>
          Page {page} of {totalPages}
        </span>}
        {isOverdue && <span className="text-xs">Showing all pending requests — overdue filtered client-side</span>}
      </div>

      {/* Command Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <h3 className="text-base font-medium">No requests found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0
                ? "All caught up! No requests match your filters."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          filteredApprovals.map((item) => (
            <ApprovalCommandCard
              key={item.id}
              item={item}
              onActionComplete={() => mutate()}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isOverdue && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
