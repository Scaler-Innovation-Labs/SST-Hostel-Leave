"use client";

import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Clock, Loader2, LogIn, LogOut, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { PageHeader } from "@/components/shared/PageHeader";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { Button } from "@/design-system/sst";
import { fetcher } from "@/lib/api/fetcher";
import { getLeavesUrl } from "@/lib/api/leave-api";
import { manualCheckout, manualReturn, markOverdue } from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

type ApprovedLeave = {
  leave: { id: string; requestNumber: string; startAt: string; endAt: string; status: string };
  student: { id: string; rollNumber: string; currentLocationState: string | null } | null;
  user: { fullName: string } | null;
  leaveType: { name: string } | null;
};

type ApprovedLeavesResponse = {
  data?: { items: ApprovedLeave[] };
};

type StatusFilter = "ALL" | "OVERDUE" | "OUTSIDE" | "IN_HOSTEL";

function getStudentLocation(item: ApprovedLeave): "OVERDUE" | "OUTSIDE_HOSTEL" | "IN_HOSTEL" {
  if (item.leave.status === "OVERDUE") return "OVERDUE";
  if (item.student?.currentLocationState === MOVEMENT_STATE.OVERDUE) return "OVERDUE";
  const loc = item.student?.currentLocationState ?? MOVEMENT_STATE.IN_HOSTEL;
  if (
    (loc === MOVEMENT_STATE.CHECKED_OUT || loc === MOVEMENT_STATE.OUTSIDE_HOSTEL) &&
    new Date(item.leave.endAt).getTime() < Date.now()
  ) {
    return "OVERDUE";
  }
  if (loc === MOVEMENT_STATE.CHECKED_OUT || loc === MOVEMENT_STATE.OUTSIDE_HOSTEL) {
    return "OUTSIDE_HOSTEL";
  }
  return "IN_HOSTEL";
}

export function ManualMovementPage(): React.JSX.Element {
  const { data, error, isLoading, mutate } = useSWR<ApprovedLeavesResponse>(
    getLeavesUrl({ status: "APPROVED,OVERDUE", limit: 100, sortBy: "startAt", sortOrder: "asc" }),
    fetcher,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const leaves = useMemo(() => data?.data?.items ?? [], [data?.data?.items]);

  const overdueCount = leaves.filter((item) => item.student && getStudentLocation(item) === "OVERDUE").length;
  const outsideCount = leaves.filter((item) => item.student && getStudentLocation(item) === "OUTSIDE_HOSTEL").length;
  const inHostelCount = leaves.filter((item) => item.student && getStudentLocation(item) === "IN_HOSTEL").length;

  const filteredLeaves = useMemo(() => {
    return leaves.filter((item) => {
      if (!item.student) return false;
      const loc = getStudentLocation(item);
      if (statusFilter === "OVERDUE" && loc !== "OVERDUE") return false;
      if (statusFilter === "OUTSIDE" && loc !== "OUTSIDE_HOSTEL") return false;
      if (statusFilter === "IN_HOSTEL" && loc !== "IN_HOSTEL") return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = (item.user?.fullName ?? "").toLowerCase();
        const roll = (item.student.rollNumber ?? "").toLowerCase();
        return name.includes(q) || roll.includes(q);
      }
      return true;
    });
  }, [leaves, statusFilter, search]);

  async function handleCheckIn(leave: ApprovedLeave): Promise<void> {
    if (!leave.student) return;
    setUpdatingId(leave.leave.id);
    try {
      await manualReturn(leave.student.id);
      toast.success("Check-in recorded (student returned to hostel)");
      await mutate();
    } catch (movementError) {
      toast.error(movementError instanceof Error ? movementError.message : "Could not record check-in");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCheckOut(leave: ApprovedLeave): Promise<void> {
    if (!leave.student) return;
    setUpdatingId(leave.leave.id);
    try {
      await manualCheckout(leave.student.id, undefined, leave.leave.id);
      toast.success("Check-out recorded");
      await mutate();
    } catch (movementError) {
      toast.error(movementError instanceof Error ? movementError.message : "Could not record check-out");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleMarkOverdue(leave: ApprovedLeave): Promise<void> {
    if (!leave.student) return;
    setUpdatingId(leave.leave.id);
    try {
      await markOverdue(leave.student.id);
      toast.success("Student marked as overdue");
      await mutate();
    } catch (movementError) {
      toast.error(movementError instanceof Error ? movementError.message : "Could not mark student as overdue");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate"
        title="Manual movement"
        description="Record check-outs, check-ins, or overdue status updates when a QR code cannot be scanned. Every action is added to movement history."
      />

      <Button asChild variant="outline" size="lg">
        <Link href="/guard/scanner"><ArrowLeft className="h-5 w-5" aria-hidden />Back to scanner</Link>
      </Button>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-light p-4 text-danger">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
            <div>
              <p className="text-body font-semibold">{overdueCount} student{overdueCount !== 1 ? "s are" : " is"} currently overdue</p>
              <p className="text-caption text-danger/80">Check them in below when they arrive or view their status details.</p>
            </div>
          </div>
          {statusFilter !== "OVERDUE" && (
            <button
              type="button"
              onClick={() => setStatusFilter("OVERDUE")}
              className="shrink-0 rounded-lg bg-danger px-3 py-1.5 text-caption font-medium text-on-fill transition-opacity hover:opacity-90"
            >
              View Overdue
            </button>
          )}
        </div>
      )}

      {/* Search and status filter controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "ALL" as const, label: "All", count: leaves.length },
            { id: "OVERDUE" as const, label: "Overdue", count: overdueCount, tone: "danger" as const },
            { id: "OUTSIDE" as const, label: "Outside", count: outsideCount, tone: "warning" as const },
            { id: "IN_HOSTEL" as const, label: "In Hostel", count: inHostelCount, tone: "success" as const },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-caption font-medium transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-muted hover:bg-surface-sunken hover:text-ink"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-micro font-semibold",
                    tab.tone === "danger"
                      ? "bg-danger-light text-danger"
                      : tab.tone === "warning"
                      ? "bg-warning-light text-warning"
                      : tab.tone === "success"
                      ? "bg-success-light text-success"
                      : "bg-surface-sunken text-muted"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}
      {error && <p className="rounded-xl border border-danger/30 bg-danger-light p-4 text-danger">Unable to load leaves.</p>}
      {!isLoading && !error && filteredLeaves.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {search || statusFilter !== "ALL"
            ? "No students match the current filter or search criteria."
            : "No students currently have an approved or overdue leave."}
        </p>
      )}

      <div className="space-y-3">
        {filteredLeaves.map((item) => {
          if (!item.student) return null;
          const location = getStudentLocation(item);
          const isUpdating = updatingId === item.leave.id;

          return (
            <article key={item.leave.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    location === "OVERDUE"
                      ? "bg-danger-light text-danger"
                      : location === "OUTSIDE_HOSTEL"
                      ? "bg-warning-light text-warning"
                      : "bg-accent/10 text-accent"
                  )}
                >
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold">{item.user?.fullName ?? "Student"}</p>
                  <p className="text-caption text-muted">{item.student.rollNumber} · {item.leaveType?.name ?? "Leave"}</p>
                  <p className="mt-1 text-caption text-muted">
                    {format(new Date(item.leave.startAt), "d MMM, HH:mm")} – {format(new Date(item.leave.endAt), "d MMM, HH:mm")}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-micro font-medium border",
                    location === "OVERDUE"
                      ? "border-danger/30 bg-danger-light text-danger"
                      : location === "OUTSIDE_HOSTEL"
                      ? "border-warning/30 bg-warning-light text-warning"
                      : "border-success/30 bg-success-light text-success"
                  )}
                >
                  {location === "OVERDUE"
                    ? "Overdue"
                    : location === "OUTSIDE_HOSTEL"
                    ? "Outside"
                    : "In Hostel"}
                </span>
              </div>

              {/* Status change actions */}
              {location === "OVERDUE" && (
                <Button
                  size="guard"
                  block
                  className="mt-4"
                  variant="success"
                  loading={isUpdating}
                  loadingText="Recording check-in…"
                  onClick={() => handleCheckIn(item)}
                >
                  <LogIn className="h-6 w-6" aria-hidden />
                  Check in (Return to hostel)
                </Button>
              )}

              {location === "OUTSIDE_HOSTEL" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="guard"
                    className="flex-1"
                    variant="success"
                    loading={isUpdating}
                    loadingText="Recording check-in…"
                    onClick={() => handleCheckIn(item)}
                  >
                    <LogIn className="h-6 w-6" aria-hidden />
                    Check in
                  </Button>
                  <Button
                    size="guard"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger-light"
                    loading={isUpdating}
                    loadingText="Updating…"
                    onClick={() => handleMarkOverdue(item)}
                  >
                    <Clock className="h-6 w-6" aria-hidden />
                    Mark overdue
                  </Button>
                </div>
              )}

              {location === "IN_HOSTEL" && (
                <Button
                  size="guard"
                  block
                  className="mt-4"
                  variant="primary"
                  loading={isUpdating}
                  loadingText="Recording check-out…"
                  onClick={() => handleCheckOut(item)}
                >
                  <LogOut className="h-6 w-6" aria-hidden />
                  Check out
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
