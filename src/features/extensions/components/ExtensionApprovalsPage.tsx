"use client";

import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { HostelFilter } from "@/components/shared/HostelFilter";
import { InfoCard } from "@/components/shared/InfoCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY, WORKFLOW_STEP_KEY, WORKFLOW_STEP_KEYS } from "@/constants/workflow/workflow-step-key";
import { ApprovalCommandCard } from "@/features/approvals/components/ApprovalCommandCard";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { fetcher } from "@/lib/api/fetcher";
import { computeDateRange, DATE_RANGE_OPTIONS } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// ── Step display mapping (same as the approvals page) ──
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
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === WORKFLOW_STEP_KEY.PARENT_APPROVAL || key.includes(WORKFLOW_STEP_KEY.PARENT_APPROVAL))
    return {
      icon: <User className="h-4 w-4" />,
      label: "Parent Approval",
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === WORKFLOW_STEP_KEY.POC_APPROVAL || key.includes(WORKFLOW_STEP_KEY.POC_APPROVAL))
    return {
      icon: <Shield className="h-4 w-4" />,
      label: "POC Approval",
      color: "text-warning",
      bgClass: "bg-warning-light hover:bg-warning-light border-warning/40 dark:border-warning/30",
    };
  if (key === WORKFLOW_STEP_KEY.ADMIN_APPROVAL || key.includes(WORKFLOW_STEP_KEY.ADMIN_APPROVAL))
    return {
      icon: <Building2 className="h-4 w-4" />,
      label: "Admin Approval",
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === VIEW_STEP_KEY.COMPLETE || key.includes(VIEW_STEP_KEY.COMPLETE))
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Completed",
      color: "text-success",
      bgClass: "bg-success-light hover:bg-success-light border-success/40 dark:border-success/30",
    };
  const fallbackLabel = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    icon: <Clock className="h-4 w-4" />,
    label: fallbackLabel || "Unknown",
    color: "text-muted",
    bgClass: "bg-surface-sunken hover:bg-surface-hover border-border",
  };
}

function stepKeyToFilterLabel(stepKey: string): string {
  if (stepKey === "") return "All Status";
  if (stepKey === VIEW_STEP_KEY.COMPLETE) return "Completed";
  return getStepDisplay(stepKey).label;
}

type FilterState = {
  status: string;
  waitingOn: string;
  leaveTypeId: string;
  hostelId: string;
  dateRange: string;
  search: string;
};

export function ExtensionApprovalsPage() {
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

  const dateRange = useMemo(() => computeDateRange(filters.dateRange), [filters.dateRange]);

  const { data, isLoading, mutate } = useExtensionApprovals({
    page,
    limit: 20,
    status: filters.status || undefined,
    search: filters.search || undefined,
    waitingOn: filters.waitingOn || undefined,
    hostelId: filters.hostelId || undefined,
    leaveTypeId: filters.leaveTypeId || undefined,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const stats = data?.stats;
  /** The standing state of the screen: what is still undecided, unfiltered. */
  const pendingExtensions = stats?.pending ?? 0;

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: "", waitingOn: "", leaveTypeId: "", hostelId: "", dateRange: "", search: "" });
    setPage(1);
  };

  // ── Step grouping for top cards (pending extensions only) ──
  const stepGroups = useMemo(() => {
    const groups = new Map<string, { count: number; stepKey: string }>();
    for (const a of items) {
      if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) continue;
      const key = a.stepKey || VIEW_STEP_KEY.POLICY;
      const existing = groups.get(key) ?? { count: 0, stepKey: key };
      existing.count++;
      groups.set(key, existing);
    }
    const stepOrder = [VIEW_STEP_KEY.POLICY, ...WORKFLOW_STEP_KEYS];
    return Array.from(groups.entries())
      .map(([, g]) => g)
      .sort((a, b) => {
        const aIdx = stepOrder.indexOf(a.stepKey as typeof stepOrder[number]);
        const bIdx = stepOrder.indexOf(b.stepKey as typeof stepOrder[number]);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
  }, [items]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Active step keys for the Waiting On filter options
  const activeStepKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of items) {
      if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) continue;
      const key = a.stepKey || VIEW_STEP_KEY.POLICY;
      keys.add(key);
    }
    return keys;
  }, [items]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Queues"
        title="Extensions"
        description="Requests to push back a return date. An extension amends an existing leave — it never becomes a new one."
        status={
          pendingExtensions > 0
            ? {
                label: `${pendingExtensions} awaiting you`,
                tone: "warning" as const,
              }
            : { label: "Nothing waiting on you", tone: "success" as const }
        }
      />

      {/* Summary cards — scope-wide totals (clicking a card filters the list) */}
      {stats && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Total Extensions",
              value: stats.total ?? 0,
              tone: "accent" as const,
              status: "",
              icon: <FileText className="h-4 w-4" />,
            },
            {
              label: "Pending Approvals",
              value: stats.pending ?? 0,
              tone: "warning" as const,
              status: LEAVE_REQUEST_STATUS.PENDING,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Approved",
              value: stats.approved ?? 0,
              tone: "success" as const,
              status: LEAVE_REQUEST_STATUS.APPROVED,
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
            {
              label: "Rejected",
              value: stats.rejected ?? 0,
              tone: "danger" as const,
              status: LEAVE_REQUEST_STATUS.REJECTED,
              icon: <X className="h-4 w-4" />,
            },
          ].map((card) => (
            <InfoCard
              key={card.label}
              compact
              icon={card.icon}
              label={card.label}
              value={card.value}
              tone={card.tone}
              active={filters.status === card.status}
              onClick={() => updateFilter("status", filters.status === card.status ? "" : card.status)}
            />
          ))}
        </section>
      )}

      {/* Step cards — dynamic workflow step counts */}
      <div className="flex flex-wrap gap-3">
        {stepGroups.map((g) => {
          const display = getStepDisplay(g.stepKey);
          const isActive = filters.waitingOn === g.stepKey;
          return (
            <button
              key={g.stepKey}
              type="button"
              onClick={() => updateFilter("waitingOn", isActive ? "" : g.stepKey)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                display.bgClass,
                isActive && "ring-2 ring-accent/40",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  display.color,
                  "bg-bg/60",
                )}
              >
                {display.icon}
              </div>
              <div>
                <div className={cn("text-body font-semibold", display.color)}>
                  {display.label}
                </div>
                <div className="text-h2 font-semibold tabular-nums">
                  {g.count}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
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
            {(leaveTypes as Array<{ id: string; name: string }>).map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>
                {lt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <HostelFilter
          value={filters.hostelId}
          hostels={hostels}
          onChange={(v) => updateFilter("hostelId", v)}
        />

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
            className="text-muted"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-caption text-muted">
        <span>
          <span className="font-medium text-ink">
            {items.length}
          </span>{" "}
          of{" "}
          <span className="font-medium text-ink">{total}</span> request
          {total !== 1 ? "s" : ""}
          {hasActiveFilters && <span> (filtered)</span>}
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Command Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-sunken" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <h3 className="text-body-lg font-medium">No extension requests found</h3>
            <p className="mt-1 text-body text-muted">
              {total === 0
                ? "All caught up! No extension requests match your filters."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ApprovalCommandCard
              key={item.id}
              item={item}
              hrefPrefix="/super-admin/extension-approvals"
              onActionComplete={() => mutate()}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
