"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataToolbar } from "@/components/shared/DataToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/table/DataTable";
import { Button } from "@/components/ui/button";
import { useHostels } from "@/hooks/use-hostels";
import { useMovement } from "@/hooks/use-movement";
import { computeDateRange, DATE_RANGE_OPTIONS, formatDateTime } from "@/lib/date-utils";

const EVENT_TYPE_OPTIONS = [
  { value: "EXIT_HOSTEL", label: "Exit Hostel" },
  { value: "ENTER_HOSTEL", label: "Enter Hostel" },
  { value: "MANUAL_CHECKOUT", label: "Manual Checkout" },
  { value: "MANUAL_RETURN", label: "Manual Return" },
  { value: "AUTO_OVERDUE", label: "Auto Overdue" },
  { value: "SECURITY_OVERRIDE", label: "Security Override" },
  { value: "LEAVE_APPROVED", label: "Leave Approved" },
  { value: "QR_INVALIDATED", label: "QR Invalidated" },
];

function getEventBadgeStyle(eventType: string): string {
  switch (eventType) {
    case "ENTER_HOSTEL":
    case "MANUAL_RETURN":
      return "bg-success-light text-success ring-1 ring-inset ring-success/20";
    case "EXIT_HOSTEL":
    case "MANUAL_CHECKOUT":
      return "bg-accent-light text-accent ring-1 ring-inset ring-accent/20";
    case "AUTO_OVERDUE":
      return "bg-danger-light text-danger ring-1 ring-inset ring-danger/20";
    case "SECURITY_OVERRIDE":
      return "bg-warning-light text-warning ring-1 ring-inset ring-warning/20";
    default:
      return "bg-surface-sunken text-muted ring-1 ring-inset ring-border";
  }
}

type MovementRow = {
  id: string;
  eventType: string;
  studentName: string | null;
  studentRollNumber: string | null;
  fromState: string | null;
  toState: string | null;
  fromStateName: string | null;
  toStateName: string | null;
  source?: string | null;
  occurredAt?: string | null;
  createdAt: string;
};

type MovementsPageProps = {
  title?: string;
  description?: string;
};

export function MovementsPage({
  title = "Movement History",
  description = "Track all student movements across gates and turnstiles.",
}: MovementsPageProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [dateRange, setDateRange] = useState("");

  const { hostels } = useHostels();

  const { dateFrom, dateTo } = useMemo(() => computeDateRange(dateRange), [dateRange]);

  const { movements, total, isLoading, isError, error, mutate } = useMovement({
    page,
    limit: 20,
    search: search.trim() || undefined,
    eventType: eventType || undefined,
    hostelId: hostelId || undefined,
    dateFrom,
    dateTo,
  });

  const totalPages = Math.ceil(total / 20);

  const hasActiveFilters = Boolean(search || eventType || hostelId || dateRange);

  const handleResetFilters = () => {
    setSearch("");
    setEventType("");
    setHostelId("");
    setDateRange("");
    setPage(1);
  };

  const hostelOptions = useMemo(() => {
    return (hostels ?? []).map((h) => ({ value: h.id, label: h.name }));
  }, [hostels]);

  const dateRangeOptions = useMemo(() => {
    return DATE_RANGE_OPTIONS.filter((opt) => opt.value !== "");
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "studentName" as keyof MovementRow,
        header: "Student",
        render: (_value: unknown, row: MovementRow) => (
          <div className="flex flex-col">
            <span className="font-medium text-ink">{row.studentName ?? "—"}</span>
            {row.studentRollNumber && (
              <span className="font-mono text-caption text-muted">{row.studentRollNumber}</span>
            )}
          </div>
        ),
      },
      {
        key: "eventType" as keyof MovementRow,
        header: "Event",
        render: (value: unknown) => {
          const type = (value as string) ?? "";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium capitalize ${getEventBadgeStyle(type)}`}
            >
              {type.replace(/_/g, " ").toLowerCase()}
            </span>
          );
        },
      },
      {
        key: "fromState" as keyof MovementRow,
        header: "Transition",
        render: (_value: unknown, row: MovementRow) => (
          <div className="flex items-center gap-1.5 text-caption">
            <span className="text-muted">{row.fromStateName ?? row.fromState?.replace(/_/g, " ") ?? "—"}</span>
            <span className="text-muted/50" aria-hidden>→</span>
            <span className="font-medium text-ink">{row.toStateName ?? row.toState?.replace(/_/g, " ") ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "source" as keyof MovementRow,
        header: "Source",
        render: (value: unknown) => (
          <span className="rounded bg-surface-sunken px-2 py-0.5 font-mono text-micro uppercase tracking-wider text-muted">
            {(value as string)?.replace(/_/g, " ") ?? "GATE"}
          </span>
        ),
      },
      {
        key: "createdAt" as keyof MovementRow,
        header: "Timestamp",
        render: (_value: unknown, row: MovementRow) => {
          const timestamp = row.occurredAt ?? row.createdAt;
          return (
            <span className="text-caption text-muted">
              {timestamp ? formatDateTime(timestamp) : "—"}
            </span>
          );
        },
      },
    ],
    [],
  );

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load movements"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={title} description={description} />
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 gap-1.5 self-start text-caption text-muted hover:text-ink sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      <DataToolbar
        searchPlaceholder="Search by student name or roll number..."
        searchValue={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        filters={[
          {
            key: "hostelId",
            label: "All Hostels",
            options: hostelOptions,
            value: hostelId,
            onChange: (val) => { setHostelId(val); setPage(1); },
          },
          {
            key: "eventType",
            label: "All Events",
            options: EVENT_TYPE_OPTIONS,
            value: eventType,
            onChange: (val) => { setEventType(val); setPage(1); },
          },
          {
            key: "dateRange",
            label: "All Time",
            options: dateRangeOptions,
            value: dateRange,
            onChange: (val) => { setDateRange(val); setPage(1); },
          },
        ]}
        total={total}
        noun="movement event"
      />

      {isLoading ? (
        <LoadingState count={5} />
      ) : movements.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "No matching movements" : "No movements"}
          description={
            hasActiveFilters
              ? "No movement events found matching your filter criteria. Try adjusting or clearing your filters."
              : "No movement events recorded yet."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          data={movements as MovementRow[]}
          columns={columns}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
