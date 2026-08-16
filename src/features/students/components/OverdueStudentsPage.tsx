"use client";

import { ArrowRight, Building2, Clock, Mail, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HostelFilter } from "@/components/shared/HostelFilter";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { useStudents } from "@/features/students/hooks/use-students";
import { fetcher } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";

type HostelOption = { id: string; name: string; code: string };

type StudentData = {
  id: string;
  rollNumber: string;
  roomNumber: string | null;
  currentLocationState: string;
};

type UserData = {
  fullName: string;
  email: string;
  hostelId: string | null;
};

type StudentRow = {
  student: StudentData;
  user: UserData | null;
};

type OverdueStudentsPageProps = {
  /** Base path to a student's detail page, e.g. "/admin/students". */
  detailBasePath: string;
};

function getAvatarColor(id: string): string {
  const colors = [
    "bg-red-500/10 text-red-600 dark:text-red-400",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    "bg-red-500/10 text-red-600 dark:text-red-400",
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

export function OverdueStudentsPage({ detailBasePath }: OverdueStudentsPageProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [hostelId, setHostelId] = useState("");

  const { students, total, isLoading, isError, error, mutate } = useStudents({
    page,
    limit: 20,
    locationState: MOVEMENT_STATE.OVERDUE,
    search: search || undefined,
    hostelId: hostelId || undefined,
  });

  const { data: hostels } = useSWR<HostelOption[]>("/api/v1/hostels", fetcher);

  const totalPages = Math.ceil(total / 20);
  const hasActiveFilters = search !== "" || hostelId !== "";

  const hostelNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hostels ?? []) map.set(h.id, h.name);
    return map;
  }, [hostels]);

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load overdue students"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overdue"
        description="Students who have not returned to the hostel after their leave ended."
      />

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Overdue Students" value={total} icon={<Clock className="h-4 w-4" />} tone="danger" />
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <HostelFilter
          value={hostelId}
          hostels={hostels}
          onChange={(v) => {
            setHostelId(v);
            setPage(1);
          }}
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setSearch("");
              setHostelId("");
              setPage(1);
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        <span>
          Showing{" "}
          <span className="font-medium text-foreground">{students.length}</span> of{" "}
          <span className="font-medium text-foreground">{total}</span> overdue student{total !== 1 ? "s" : ""}
          {hasActiveFilters && <span> (filtered)</span>}
        </span>
      </div>

      {isLoading ? (
        <LoadingState count={5} />
      ) : students.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "No overdue students found" : "All caught up"}
          description={
            hasActiveFilters
              ? "No students match your search or filters."
              : "No students are currently overdue — everyone has returned."
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border">
            {students.map((row: StudentRow) => {
              const student = row.student;
              const user = row.user;
              const hostelName = user?.hostelId ? hostelNames.get(user.hostelId) : undefined;

              return (
                <Link
                  key={student.id}
                  href={`${detailBasePath}/${student.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                      getAvatarColor(student.id),
                    )}
                  >
                    {getInitials(user?.fullName ?? "?")}
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {user?.fullName ?? "—"}
                      </span>
                      <span className="inline-flex shrink-0 items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                        Overdue
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{student.rollNumber ?? "—"}</span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user?.email ?? "—"}
                      </span>
                      {student.roomNumber && <span>Room {student.roomNumber}</span>}
                      {hostelName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {hostelName}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
