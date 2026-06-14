"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/table/DataTable";
import { useMovement } from "@/hooks/use-movement";

const EVENT_TYPE_OPTIONS = [
  { value: "APPROVE_LEAVE", label: "Leave Approved" },
  { value: "EXIT_HOSTEL", label: "Exit Hostel" },
  { value: "ENTER_HOSTEL", label: "Enter Hostel" },
  { value: "MARK_OVERDUE", label: "Marked Overdue" },
  { value: "MANUAL_RETURN", label: "Manual Return" },
];

type MovementRow = {
  id: string;
  eventType: string;
  studentName: string | null;
  fromState: string | null;
  toState: string | null;
  createdAt: string;
};

export default function AdminMovementsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");

  const { movements, total, isLoading, isError, error, mutate } = useMovement({
    page,
    limit: 20,
    search: search || undefined,
    eventType: eventType || undefined,
  });

  const totalPages = Math.ceil(total / 20);

  const columns = useMemo(
    () => [
      {
        key: "studentName" as keyof MovementRow,
        header: "Student",
        render: (_value: unknown, row: MovementRow) => (
          <span className="font-medium">{row.studentName ?? "—"}</span>
        ),
      },
      {
        key: "eventType" as keyof MovementRow,
        header: "Event",
        render: (value: unknown) => (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
            {(value as string)?.replace(/_/g, " ").toLowerCase()}
          </span>
        ),
      },
      {
        key: "fromState" as keyof MovementRow,
        header: "From",
        render: (value: unknown) => (
          <span className="text-xs text-muted-foreground">
            {(value as string)?.replace(/_/g, " ") ?? "—"}
          </span>
        ),
      },
      {
        key: "toState" as keyof MovementRow,
        header: "To",
        render: (value: unknown) => (
          <span className="text-xs text-muted-foreground">
            {(value as string)?.replace(/_/g, " ") ?? "—"}
          </span>
        ),
      },
      {
        key: "createdAt" as keyof MovementRow,
        header: "Timestamp",
        render: (value: unknown) => (
          <span className="text-xs text-muted-foreground">
            {(value as string)?.split("T")[0]}
          </span>
        ),
      },
    ],
    [],
  );

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load movements"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Movement History" description="Track all student movements." />

      <DataToolbar
        searchPlaceholder="Search by student name..."
        searchValue={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        filters={[
          {
            key: "eventType",
            label: "All Events",
            options: EVENT_TYPE_OPTIONS,
            value: eventType,
            onChange: (val) => { setEventType(val); setPage(1); },
          },
        ]}
        total={total}
      />

      {isLoading ? (
        <LoadingState count={5} />
      ) : movements.length === 0 ? (
        <EmptyState title="No movements" description="No movement events recorded yet." />
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
