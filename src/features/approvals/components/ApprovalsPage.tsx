"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api/fetcher";

const OVERDUE_LIMIT = 200;

import { CheckCircle2, Clock, FileText, Search, X } from "lucide-react";

import { HostelFilter } from "@/components/shared/HostelFilter";
import { InfoCard } from "@/components/shared/InfoCard";
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
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { FilterChip } from "@/design-system/sst";
import { ApprovalCommandCard } from "@/features/approvals/components/ApprovalCommandCard";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";
import {
  countPendingByStep,
  getStepDisplay,
  sortByStepOrder,
  stepKeyToFilterLabel,
  toWaitingOnStepKeys,
} from "@/features/approvals/lib/step-display";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { computeDateRange, DATE_RANGE_OPTIONS } from "@/lib/date-utils";

const OVERDUE_HOURS = 24;

type FilterState = {
  status: string;
  waitingOn: string;
  leaveTypeId: string;
  hostelId: string;
  dateRange: string;
  search: string;
};

type ApprovalsPageProps = {
  /** Renders the "Approvals" page header. Set false when embedding inside another page. */
  showHeader?: boolean;
  /**
   * Base path for the per-approval detail page, e.g. "/poc/approvals" when
   * the list is embedded on a different route. Defaults to the current path.
   */
  hrefPrefix?: string;
  /**
   * Disable click-through to a per-approval detail page. Needed when the
   * role has no detail route.
   */
  disableNavigation?: boolean;
  /**
   * The current viewer's role, used by the command cards to decide whether
   * action buttons are shown (e.g. a POC acts on POC-waiting cards).
   */
  viewerRole?: "POC" | "ADMIN" | "SUPER_ADMIN";
};

export function ApprovalsPage({ showHeader = true, hrefPrefix, disableNavigation = false, viewerRole }: ApprovalsPageProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    status: "",
    waitingOn: "",
    leaveTypeId: "",
    hostelId: "",
    dateRange: "",
    search: "",
  });

  const [now] = useState(() => Date.now());

  const { leaveTypes } = useLeaveTypes();
  const { stats } = useDashboardStats();
  const { data: hostels } = useSWR<Array<{ id: string; name: string; code: string }>>("/api/v1/hostels", fetcher);

  // Derive API-ready date range from the friendly range label
  const dateRange = useMemo(() => computeDateRange(filters.dateRange), [filters.dateRange]);

  const isOverdue = filters.status === "OVERDUE";

  const { approvals, total, totalPages, stepBreakdown, isLoading, mutate } = useApprovals({
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
        const hoursSince = (now - created.getTime()) / (1000 * 60 * 60);
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
  }, [approvals, filters.status, filters.waitingOn, now]);

  /*
   * Which step each request is sitting at, counted by the server across the
   * whole queue with every filter applied except this one. Counting it from
   * the page would let a chip rewrite its own number the moment it is
   * selected — and hide every step it filtered out. Overdue has no
   * server-side equivalent, so that view alone still counts what it holds.
   */
  const stepGroups = useMemo(
    () =>
      sortByStepOrder(
        isOverdue ? countPendingByStep(filteredApprovals) : stepBreakdown,
      ),
    [isOverdue, filteredApprovals, stepBreakdown],
  );

  const overdueCount = useMemo(
    () =>
      filteredApprovals.filter((a) => {
        if (a.decision !== LEAVE_APPROVAL_DECISION.PENDING) return false;
        const created = new Date(a.createdAt);
        return (now - created.getTime()) / (1000 * 60 * 60) > OVERDUE_HOURS;
      }).length,
    [filteredApprovals, now],
  );

  /**
   * What is still undecided in this queue. The API already scopes the queue to
   * the viewer's role, so a pending item here is one they can act on. Summed
   * from the step breakdown, which spans the queue rather than the page.
   */
  const pendingForViewer = useMemo(
    () => stepGroups.reduce((sum, group) => sum + group.count, 0),
    [stepGroups],
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // The Waiting On options are the steps the queue actually has work at, so
  // they come from the same breakdown as the chips.
  const activeStepKeys = useMemo(() => toWaitingOnStepKeys(stepGroups), [stepGroups]);

  return (
    <div className="space-y-5">
      {/* Header */}
      {showHeader && (
        <PageHeader
          eyebrow={isOverdue ? "Queues · Overdue" : "Queues"}
          title={isOverdue ? "Overdue returns" : "Approvals"}
          description={
            isOverdue
              ? "Students who are past the return time on an approved leave."
              : "Leave requests waiting on a decision. The chain decides who sees each one."
          }
          /*
           * The standing state is what is waiting on *you* — the filtered count
           * already appears above the list, so repeating it here says nothing.
           */
          status={
            pendingForViewer > 0
              ? {
                  label: `${pendingForViewer} awaiting you`,
                  tone: "warning" as const,
                }
              : { label: "Nothing waiting on you", tone: "success" as const }
          }
        />
      )}

      {/* Summary cards — aggregates from the dashboard stats read-model, clickable as status filters.
          Hidden for POC viewers, whose dashboard shows only their own action queue. */}
      {stats && viewerRole !== "POC" && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Total Leaves",
              value: (stats as { totalLeaves?: number }).totalLeaves ?? 0,
              tone: "accent" as const,
              status: "",
              icon: <FileText className="h-4 w-4" />,
            },
            {
              label: "Pending Approvals",
              value: (stats as { pendingApprovals?: number }).pendingApprovals ?? 0,
              tone: "warning" as const,
              status: LEAVE_REQUEST_STATUS.PENDING,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Approved",
              value: (stats as { approvedLeaves?: number }).approvedLeaves ?? 0,
              tone: "success" as const,
              status: LEAVE_REQUEST_STATUS.APPROVED,
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
            {
              label: "Rejected",
              value: (stats as { rejectedLeaves?: number }).rejectedLeaves ?? 0,
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

      {/*
        Which step each request is sitting with. These are filters rather than
        metrics, so they stay neutral and let the accent mark the active one.
      */}
      <div className="flex flex-wrap gap-2">
        {stepGroups.map((group) => {
          const display = getStepDisplay(group.stepKey);
          const isActive = filters.waitingOn === group.stepKey;

          return (
            <FilterChip
              key={group.stepKey}
              label={display.label}
              count={group.count}
              active={isActive}
              onClick={() => {
                if (isOverdue) {
                  setFilters((prev) => ({
                    ...prev,
                    status: "",
                    waitingOn: group.stepKey,
                  }));
                  setPage(1);
                } else {
                  updateFilter("waitingOn", isActive ? "" : group.stepKey);
                }
              }}
            />
          );
        })}

        {overdueCount > 0 && (
          <FilterChip
            label="Overdue"
            count={overdueCount}
            Icon={Clock}
            active={filters.status === "OVERDUE"}
            onClick={() => {
              if (filters.status === "OVERDUE") {
                updateFilter("status", "");
              } else {
                setPage(1);
                setFilters((prev) => ({
                  ...prev,
                  status: "OVERDUE",
                  waitingOn: "",
                }));
              }
            }}
          />
        )}
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
            {activeStepKeys.map((key) => (
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
            {leaveTypes.map((lt) => (
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
            {filteredApprovals.length}
          </span>{" "}
          of{" "}
          <span className="font-medium text-ink">{total}</span> request
          {total !== 1 ? "s" : ""}
          {hasActiveFilters && <span> (filtered)</span>}
        </span>
        {!isOverdue && <span>
          Page {page} of {totalPages}
        </span>}
        {isOverdue && <span className="text-caption">Showing all pending requests — overdue filtered client-side</span>}
      </div>

      {/* Command Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-sunken" />
            ))}
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <h3 className="text-body-lg font-medium">No requests found</h3>
            <p className="mt-1 text-body text-muted">
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
              hrefPrefix={hrefPrefix}
              disableNavigation={disableNavigation}
              viewerRole={viewerRole}
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
          <span className="text-caption text-muted">
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
