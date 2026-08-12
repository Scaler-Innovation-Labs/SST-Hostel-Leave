"use client";

import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Mail,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HostelFilter } from "@/components/shared/HostelFilter";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return [];
  const r = await res.json();
  return Array.isArray(r?.data) ? r.data : [];
};

type HostelOption = { id: string; name: string; code: string };

type OverdueReturn = {
  id: string;
  studentId: string;
  firstScanAt: string | null;
  status: string;
  studentName: string | null;
  studentRollNumber: string | null;
  roomNumber: string | null;
  hostelId: string | null;
  hostelName: string | null;
  leaveTypeName: string | null;
  requestNumber: string | null;
  leaveStartAt: string | null;
  leaveEndAt: string | null;
};

type OverdueReturnsPageProps = {
  /** Base path to a student's detail page, e.g. "/admin/students". */
  detailBasePath: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysOverdue(endAt: string | null, now: number): number {
  if (!endAt) return 0;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((now - end) / DAY_MS));
}

function getAvatarColor(id: string): string {
  const colors = [
    "bg-red-500/10 text-red-600 dark:text-red-400",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Students who checked out (QR scanned at exit) but have not checked back in
 * (no return scan) even though their leave duration has ended. Scoped to the
 * current user's hostels by the API — a hostel-scoped admin only sees their
 * own hostels' students.
 */
export function OverdueReturnsPage({ detailBasePath }: OverdueReturnsPageProps) {
  const [search, setSearch] = useState("");
  const [hostelId, setHostelId] = useState("");
  // Stable "now" captured once per mount (impure calls aren't allowed in render).
  const [now] = useState(() => Date.now());

  const { data, error, isLoading, mutate } = useSWR<OverdueReturn[]>("/api/v1/overdue", fetcher, {
    refreshInterval: 15_000,
  });

  const { data: hostels } = useSWR<HostelOption[]>("/api/v1/hostels", fetcher);

  const overdue = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => {
        if (hostelId && r.hostelId !== hostelId) return false;
        if (!q) return true;
        return (
          (r.studentName ?? "").toLowerCase().includes(q) ||
          (r.studentRollNumber ?? "").toLowerCase().includes(q) ||
          (r.requestNumber ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => daysOverdue(b.leaveEndAt, now) - daysOverdue(a.leaveEndAt, now));
  }, [data, search, hostelId, now]);

  const hasActiveFilters = search !== "" || hostelId !== "";

  if (error) {
    return (
      <ErrorState
        message={error?.message ?? "Failed to load overdue returns"}
        onRetry={() => mutate()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overdue"
        description="Students who checked out but haven't returned after their leave ended."
      />

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Overdue Returns"
          value={overdue.length}
          icon={<Clock className="h-4 w-4" />}
          tone="danger"
        />
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll, or request ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <HostelFilter value={hostelId} hostels={hostels} onChange={setHostelId} />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setSearch("");
              setHostelId("");
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
          <span className="font-medium text-foreground">{overdue.length}</span> overdue return
          {overdue.length !== 1 ? "s" : ""}
          {hasActiveFilters && <span> (filtered)</span>}
        </span>
      </div>

      {isLoading ? (
        <LoadingState count={4} />
      ) : overdue.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "No overdue returns found" : "All caught up"}
          description={
            hasActiveFilters
              ? "No students match your search or filters."
              : "No students are past their leave end date without returning."
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {overdue.map((row) => {
            const days = daysOverdue(row.leaveEndAt, now);
            return (
              <Link
                key={row.id}
                href={`${detailBasePath}/${row.studentId}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                    getAvatarColor(row.id),
                  )}
                >
                  {getInitials(row.studentName ?? "?")}
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {row.studentName ?? "—"}
                    </span>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                      {days} day{days !== 1 ? "s" : ""} overdue
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{row.studentRollNumber ?? "—"}</span>
                    {row.roomNumber && <span>Room {row.roomNumber}</span>}
                    {row.hostelName && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {row.hostelName}
                      </span>
                    )}
                    {row.leaveTypeName && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {row.leaveTypeName}
                      </span>
                    )}
                    <span className="font-mono">{row.requestNumber ?? "—"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      Leave: {row.leaveStartAt ? formatDateTime(row.leaveStartAt) : "—"} →{" "}
                      {row.leaveEndAt ? formatDateTime(row.leaveEndAt) : "—"}
                    </span>
                    {row.firstScanAt && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Checked out {formatDateTime(row.firstScanAt)}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
