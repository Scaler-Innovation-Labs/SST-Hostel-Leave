"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { useStudents } from "@/features/students/hooks/use-students";
import { cn } from "@/lib/utils";
import { ArrowRight, Mail } from "lucide-react";

const LOCATION_OPTIONS = [
  { value: MOVEMENT_STATE.IN_HOSTEL, label: "In Hostel" },
  { value: MOVEMENT_STATE.APPROVED_LEAVE, label: "Approved Leave" },
  { value: MOVEMENT_STATE.CHECKED_OUT, label: "Checked Out" },
  { value: MOVEMENT_STATE.OUTSIDE_HOSTEL, label: "Outside" },
  { value: MOVEMENT_STATE.OVERDUE, label: "Overdue" },

];

type StudentData = {
  id: string;
  rollNumber: string;
  currentLocationState: string;
};

type UserData = {
  fullName: string;
  email: string;
};

type LocationStateData = {
  code: string;
  name: string;
};

type StudentRow = {
  student: StudentData;
  user: UserData | null;
  locationState: LocationStateData | null;
};

function getAvatarColor(id: string): string {
  const colors = [
    "bg-blue-500/10 text-blue-600",
    "bg-emerald-500/10 text-emerald-600",
    "bg-violet-500/10 text-violet-600",
    "bg-amber-500/10 text-amber-600",
    "bg-rose-500/10 text-rose-600",
    "bg-cyan-500/10 text-cyan-600",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getLocationColor(code: string): string {
  if (code === MOVEMENT_STATE.IN_HOSTEL) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (code === MOVEMENT_STATE.APPROVED_LEAVE) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (code === MOVEMENT_STATE.CHECKED_OUT) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (code === MOVEMENT_STATE.OVERDUE) return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

export default function AdminStudentsPage() {
  const [page, setPage] = useState(1);
  const [locationState, setLocationState] = useState("");
  const [search, setSearch] = useState("");

  const { students, total, isLoading, isError, error, mutate } = useStudents({
    page,
    limit: 20,
    locationState: locationState || undefined,
    search: search || undefined,
  });

  const totalPages = Math.ceil(total / 20);

  const items: StudentRow[] = useMemo(
    () => students as StudentRow[],
    [students],
  );

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load students"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="View all registered students."
      />

      <DataToolbar
        searchPlaceholder="Search by name or roll number..."
        searchValue={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        filters={[
          {
            key: "location",
            label: "All Locations",
            options: LOCATION_OPTIONS,
            value: locationState,
            onChange: (val) => { setLocationState(val); setPage(1); },
          },
        ]}
        total={total}
      />

      {isLoading ? (
        <LoadingState count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title={search || locationState ? "No students found" : "No students yet"}
          description={
            search || locationState
              ? "No students match your search or filters."
              : "No students have been registered yet."
          }
        />
      ) : (
        <>
          {/* Card-based student list */}
          <div className="divide-y divide-border rounded-xl border border-border">
            {items.map((row) => {
              const locationCode = row.locationState?.code ?? row.student.currentLocationState ?? MOVEMENT_STATE.IN_HOSTEL;

              return (
                <Link
                  key={row.student.id}
                  href={`/admin/students/${row.student.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                      getAvatarColor(row.student.id),
                    )}
                  >
                    {getInitials(row.user?.fullName ?? "?")}
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {row.user?.fullName ?? "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{row.student.rollNumber ?? "—"}</span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {row.user?.email ?? "—"}
                      </span>
                    </div>
                  </div>

                  {/* Location badge + chevron */}
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize",
                        getLocationColor(locationCode),
                      )}
                    >
                      {locationCode.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
