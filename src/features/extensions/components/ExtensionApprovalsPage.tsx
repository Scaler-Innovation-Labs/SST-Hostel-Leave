"use client";

import { CheckCircle2, Clock, FileText, Search, X } from "lucide-react";
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
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { ApprovalCommandCard } from "@/features/approvals/components/ApprovalCommandCard";
import {
  getStepDisplay,
  sortByStepOrder,
  stepKeyToFilterLabel,
  toWaitingOnStepKeys,
} from "@/features/approvals/lib/step-display";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { fetcher } from "@/lib/api/fetcher";
import { computeDateRange, DATE_RANGE_OPTIONS } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

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

  /*
   * Which step each extension is sitting at, counted by the server across the
   * whole queue with every filter applied except this one. Counting it from
   * the page would let a card rewrite its own number the moment it is
   * selected — and hide every step it filtered out.
   */
  const stepGroups = useMemo(
    () => sortByStepOrder(data?.stepBreakdown ?? []),
    [data?.stepBreakdown],
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // The Waiting On options are the steps the queue actually has work at, so
  // they come from the same breakdown as the cards.
  const activeStepKeys = useMemo(() => toWaitingOnStepKeys(stepGroups), [stepGroups]);

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
