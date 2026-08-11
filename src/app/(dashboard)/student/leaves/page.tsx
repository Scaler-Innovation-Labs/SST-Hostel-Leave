"use client";

import { addDays, differenceInDays, format, isPast, parseISO } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Moon,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataToolbar } from "@/components/shared/DataToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { ROUTES } from "@/constants/routes";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: LEAVE_REQUEST_STATUS.PENDING, label: "Pending" },
  { value: LEAVE_REQUEST_STATUS.APPROVED, label: "Approved" },
  { value: LEAVE_REQUEST_STATUS.REJECTED, label: "Rejected" },
  { value: LEAVE_REQUEST_STATUS.CANCELLED, label: "Cancelled" },
  { value: LEAVE_REQUEST_STATUS.COMPLETED, label: "Completed" },
  { value: LEAVE_REQUEST_STATUS.EXPIRED, label: "Expired" },
];

type LeaveItem = {
  id: string;
  leaveTypeName: string;
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
};

function getStatusVariant(status: string): "approved" | "pending" | "rejected" | "active" {
  const lower = status.toLowerCase();
  if (lower === "approved" || lower === "completed") return "approved";
  if (lower === "pending") return "pending";
  if (lower === "rejected" || lower === "cancelled" || lower === "expired") return "rejected";
  return "pending";
}

function getLeaveTypeColor(leaveTypeName: string): string {
  const name = leaveTypeName.toUpperCase();
  if (name.includes("MEDICAL") || name.includes("HEALTH")) return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  if (name.includes("EMERGENCY")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  if (name.includes("STUDY") || name.includes("EXAM") || name.includes("ACADEMIC")) return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
  if (name.includes("INTERN") || name.includes("JOB") || name.includes("PROFESSIONAL")) return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  if (name.includes("HOME") || name.includes("PASS")) return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
  if (name.includes("NIGHT") || name.includes("STAY") || name.includes("OVERNIGHT")) return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (name.includes("CASUAL") || name.includes("LOCAL") || name.includes("OUTING")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (name.includes("GENERAL")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function getLeaveTypeIcon(leaveTypeName: string): React.ElementType {
  const name = leaveTypeName?.toUpperCase() ?? "";
  if (name.includes("HOME") || name.includes("PASS")) return Home;
  if (name.includes("MEDICAL") || name.includes("HEALTH") || name.includes("SICK")) return Heart;
  if (name.includes("EXAM") || name.includes("STUDY") || name.includes("ACADEM") || name.includes("EDUCATION")) return GraduationCap;
  if (name.includes("INTERN") || name.includes("JOB") || name.includes("PROFESSIONAL") || name.includes("PLACEMENT")) return Briefcase;
  if (name.includes("NIGHT") || name.includes("STAY") || name.includes("OVERNIGHT")) return Moon;
  if (name.includes("HOSTEL") || name.includes("CAMPUS") || name.includes("DORM")) return Building2;
  if (name.includes("GENERAL") || name.includes("CASUAL") || name.includes("LOCAL") || name.includes("OUTING") || name.includes("PERSONAL")) return MapPin;
  return Calendar;
}

function getDurationLabel(startAt: string, endAt: string): string {
  try {
    const start = parseISO(startAt);
    const end = parseISO(endAt);
    const days = differenceInDays(end, start);
    if (days === 0) return "Same day";
    if (days === 1) return "1 day";
    return `${days} days`;
  } catch {
    return "—";
  }
}

function getStatusContext(status: string): { label: string; detail?: string } {
  const s = status.toLowerCase();
  if (s === "pending") return { label: "Waiting for approval" };
  if (s === "approved") return { label: "Approved", detail: "QR available" };
  if (s === "rejected") return { label: "Not approved" };
  if (s === "cancelled") return { label: "Cancelled" };
  if (s === "completed") return { label: "Completed" };
  if (s === "expired") return { label: "Expired" };
  return { label: s };
}

export default function StudentLeavesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { leaves, total, isLoading, isError, error, mutate } = useLeaves({
    page,
    limit: 15,
    status: status || undefined,
    search: search || undefined,
  });

  const totalPages = Math.ceil(total / 15);

  const items = leaves as LeaveItem[];

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load leaves"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leaves"
        description="View and manage your leave requests."
        action={
          <Button onClick={() => router.push(ROUTES.STUDENT_LEAVE_NEW)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Leave
          </Button>
        }
      />

      <DataToolbar
        searchPlaceholder="Search leaves..."
        searchValue={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        filters={[
          {
            key: "status",
            label: "All Status",
            options: STATUS_OPTIONS,
            value: status,
            onChange: (val) => { setStatus(val); setPage(1); },
          },
        ]}
        total={total}
      />

      {isLoading ? (
        <LoadingState count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title={search || status ? "No leaves found" : "No leaves yet"}
          description={
            search || status
              ? "No leaves match your search or filters."
              : "You haven't submitted any leave requests yet."
          }
          action={
            <Button onClick={() => router.push(ROUTES.STUDENT_LEAVE_NEW)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Submit Your First Leave
            </Button>
          }
        />
      ) : (
        <>
          {/* Card-based leave list */}
          <div className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => {
              const startDate = parseISO(item.startAt);
              const endDate = parseISO(item.endAt);
              const isOverdue = isPast(addDays(endDate, 1)) && item.status === LEAVE_REQUEST_STATUS.APPROVED;
              const IconComponent = getLeaveTypeIcon(item.leaveTypeName);
              const context = getStatusContext(item.status);

              return (
                <button
                  key={item.id}
                  onClick={() => router.push(`/student/leaves/${item.id}`)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                >
                  {/* Leave type icon */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                      getLeaveTypeColor(item.leaveTypeName),
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {item.leaveTypeName} Leave
                      </span>
                      {isOverdue && (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(startDate, "MMM d")}
                        <ArrowRight className="h-3 w-3" />
                        {format(endDate, "MMM d, yyyy")}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getDurationLabel(item.startAt, item.endAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {context.label}
                      {context.detail && (
                        <span className="text-emerald-500"> · {context.detail}</span>
                      )}
                    </div>
                  </div>

                  {/* Status + chevron */}
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={getStatusVariant(item.status)} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                </button>
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
