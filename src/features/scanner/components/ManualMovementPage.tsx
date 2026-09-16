"use client";

import { format } from "date-fns";
import { ArrowLeft, Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { PageHeader } from "@/components/shared/PageHeader";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { Button } from "@/design-system/sst";
import { fetcher } from "@/lib/api/fetcher";
import { getLeavesUrl } from "@/lib/api/leave-api";
import { manualCheckout, manualReturn } from "@/lib/api/movement-api";

type ApprovedLeave = {
  leave: { id: string; requestNumber: string; startAt: string; endAt: string; status: string };
  student: { id: string; rollNumber: string; currentLocationState: string | null } | null;
  user: { fullName: string } | null;
  leaveType: { name: string } | null;
};

type ApprovedLeavesResponse = {
  data?: { items: ApprovedLeave[] };
};

export function ManualMovementPage(): React.JSX.Element {
  const { data, error, isLoading, mutate } = useSWR<ApprovedLeavesResponse>(
    getLeavesUrl({ status: "APPROVED", limit: 100, sortBy: "startAt", sortOrder: "asc" }),
    fetcher,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const leaves = data?.data?.items ?? [];

  async function recordMovement(leave: ApprovedLeave): Promise<void> {
    if (!leave.student) return;
    const currentState = leave.student.currentLocationState ?? MOVEMENT_STATE.IN_HOSTEL;
    const isReturning = [MOVEMENT_STATE.CHECKED_OUT, MOVEMENT_STATE.OUTSIDE_HOSTEL, MOVEMENT_STATE.OVERDUE].includes(currentState as typeof MOVEMENT_STATE.CHECKED_OUT);
    setUpdatingId(leave.leave.id);
    try {
      if (isReturning) {
        await manualReturn(leave.student.id);
        toast.success("Check-in recorded");
      } else {
        await manualCheckout(leave.student.id, undefined, leave.leave.id);
        toast.success("Check-out recorded");
      }
      await mutate();
    } catch (movementError) {
      toast.error(movementError instanceof Error ? movementError.message : "Could not record movement");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate"
        title="Manual movement"
        description="Record a check-out or check-in when a QR code cannot be scanned. Every action is added to movement history."
      />

      <Button asChild variant="outline" size="lg">
        <Link href="/guard/scanner"><ArrowLeft className="h-5 w-5" aria-hidden />Back to scanner</Link>
      </Button>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}
      {error && <p className="rounded-xl border border-danger/30 bg-danger-light p-4 text-danger">Unable to load approved leaves.</p>}
      {!isLoading && !error && leaves.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">No students currently have an approved leave.</p>
      )}
      <div className="space-y-3">
        {leaves.map((item) => {
          if (!item.student) return null;
          const location = item.student.currentLocationState ?? MOVEMENT_STATE.IN_HOSTEL;
          const isReturning = [MOVEMENT_STATE.CHECKED_OUT, MOVEMENT_STATE.OUTSIDE_HOSTEL, MOVEMENT_STATE.OVERDUE].includes(location as typeof MOVEMENT_STATE.CHECKED_OUT);
          const isUpdating = updatingId === item.leave.id;
          return (
            <article key={item.leave.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10"><UserRound className="h-5 w-5 text-accent" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.user?.fullName ?? "Student"}</p>
                  <p className="text-caption text-muted">{item.student.rollNumber} · {item.leaveType?.name ?? "Leave"}</p>
                  <p className="mt-1 text-caption text-muted">{format(new Date(item.leave.startAt), "d MMM, HH:mm")} – {format(new Date(item.leave.endAt), "d MMM, HH:mm")}</p>
                </div>
                <span className="rounded-full bg-surface-sunken px-2 py-1 text-micro text-muted">{location.replaceAll("_", " ")}</span>
              </div>
              <Button size="guard" block className="mt-4" variant={isReturning ? "success" : "primary"} loading={isUpdating} loadingText="Recording…" onClick={() => recordMovement(item)}>
                {isReturning ? <LogIn className="h-6 w-6" aria-hidden /> : <LogOut className="h-6 w-6" aria-hidden />}
                {isReturning ? "Checked in" : "Checked out"}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
