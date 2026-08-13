"use client";

import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  History,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LeaveTypeBadge } from "@/components/shared/LeaveTypeBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { getEventLabel } from "@/constants/notification/notification-labels";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { useStudent } from "@/features/students/hooks/use-students";
import { useMovement } from "@/hooks/use-movement";
import { manualCheckout, manualReturn, markOverdue } from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

type StudentDetailViewProps = {
  studentId: string;
  basePath?: string;
  /** Role of the viewer; location status controls show for ADMIN/SUPER_ADMIN. */
  viewerRole?: string;
};

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr?.split("T")[0] ?? "—";
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr ?? "—";
  }
}

export function StudentDetailView({ studentId, basePath = "/admin/students", viewerRole }: StudentDetailViewProps) {
  const router = useRouter();
  const movementsPath = basePath.replace(/\/students$/, "/movements");
  const approvalsPath = basePath.replace(/\/students$/, "/approvals");
  const { student, isLoading, isError, error, mutate } = useStudent(studentId);
  const { leaves } = useLeaves({ studentId, page: 1, limit: 5 });
  const { movements } = useMovement({ studentId, page: 1, limit: 10 });
  const [locationAction, setLocationAction] = useState<"checkout" | "return" | "overdue" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const canChangeLocation = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";

  if (isLoading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message={error?.message ?? "Student not found"} onRetry={() => mutate()} />;
  if (!student) return <ErrorState message="Student not found" />;

  const detail = student as {
    student: { id: string; rollNumber: string; currentLocationState: string; createdAt: string };
    user: { fullName: string; email: string; phone?: string; gender?: string; isActive: boolean; lastLoginAt?: string; createdAt: string } | null;
    locationState: { code: string; name: string } | null;
  };

  const { student: studentData, user: userData, locationState } = detail;
  const locationCode = locationState?.code ?? studentData.currentLocationState ?? MOVEMENT_STATE.IN_HOSTEL;
  const isInHostel = locationCode === MOVEMENT_STATE.IN_HOSTEL;
  const isOverdue = locationCode === MOVEMENT_STATE.OVERDUE;
  const isOnLeave = locationCode === MOVEMENT_STATE.APPROVED_LEAVE;

  const canCheckout =
    locationCode === MOVEMENT_STATE.IN_HOSTEL || locationCode === MOVEMENT_STATE.APPROVED_LEAVE;
  const canReturn =
    locationCode === MOVEMENT_STATE.CHECKED_OUT ||
    locationCode === MOVEMENT_STATE.OUTSIDE_HOSTEL ||
    locationCode === MOVEMENT_STATE.OVERDUE;
  const canMarkOverdue =
    locationCode === MOVEMENT_STATE.CHECKED_OUT ||
    locationCode === MOVEMENT_STATE.OUTSIDE_HOSTEL ||
    locationCode === MOVEMENT_STATE.APPROVED_LEAVE;

  async function runLocationAction(action: "checkout" | "return" | "overdue") {
    setActionBusy(true);
    try {
      if (action === "checkout") {
        await manualCheckout(studentId);
      } else if (action === "return") {
        await manualReturn(studentId);
      } else {
        await markOverdue(studentId);
      }
      toast.success("Location status updated");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update location status");
    } finally {
      setActionBusy(false);
      setLocationAction(null);
    }
  }

  const locationActionCopy = {
    checkout: { title: "Mark as checked out?", description: "This records a manual checkout for the student. The location status will change to Checked Out." },
    return: { title: "Mark as returned?", description: "This records a manual return for the student. The location status will change to In Hostel." },
    overdue: { title: "Mark as overdue?", description: "This records the student as overdue. The location status will change to Overdue." },
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`${basePath}`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                {userData?.fullName?.charAt(0) ?? "?"}
              </div>
              <div>
                <h1 className="text-xl font-semibold">{userData?.fullName ?? "Student"}</h1>
                <p className="text-sm text-muted-foreground">Roll: {studentData.rollNumber ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location + Status info cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Location Status"
          value={locationState?.name ?? locationCode.replace(/_/g, " ").toLowerCase()}
          icon={<MapPin className="h-4 w-4" />}
          tone={isInHostel ? "success" : isOverdue ? "danger" : "warning"}
          className={cn(
            isInHostel && "border-emerald-500/30",
            isOnLeave && "border-blue-500/30",
            isOverdue && "border-red-500/30",
          )}
        />
        <InfoCard label="Email" value={userData?.email ?? "—"} icon={<Mail className="h-4 w-4" />} tone="primary" />
        <InfoCard label="Phone" value={userData?.phone ?? "—"} icon={<Phone className="h-4 w-4" />} tone="primary" />
        <InfoCard
          label="Status"
          value={userData?.isActive ? "Active" : "Inactive"}
          icon={<Shield className="h-4 w-4" />}
          tone={userData?.isActive ? "success" : "danger"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Profile Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Profile</h3>
          </div>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Full Name</dt>
              <dd className="font-medium">{userData?.fullName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Roll Number</dt>
              <dd className="font-mono text-xs font-medium">{studentData.rollNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="font-medium capitalize">{userData?.gender ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{userData?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{userData?.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Login</dt>
              <dd className="font-medium">
                {userData?.lastLoginAt ? formatDate(userData.lastLoginAt) : "Never"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Active</dt>
              <dd>
                {userData?.isActive ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                ) : (
                  <span className="text-destructive">Inactive</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Location Details */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Current Location</h3>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                isInHostel ? "bg-emerald-500/10" : isOverdue ? "bg-red-500/10" : "bg-amber-500/10",
              )}
            >
              <MapPin
                className={cn(
                  "h-5 w-5",
                  isInHostel ? "text-emerald-500" : isOverdue ? "text-red-500" : "text-amber-500",
                )}
              />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {locationState?.name ?? locationCode.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {isInHostel ? "Currently in hostel" : isOnLeave ? "On approved leave" : isOverdue ? "Overdue return" : "Outside hostel"}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 space-y-2">
            {canChangeLocation && (
              <>
                {canCheckout && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setLocationAction("checkout")}
                    disabled={actionBusy}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Mark Checked Out
                  </Button>
                )}
                {canReturn && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setLocationAction("return")}
                    disabled={actionBusy}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Mark Returned (In Hostel)
                  </Button>
                )}
                {canMarkOverdue && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    onClick={() => setLocationAction("overdue")}
                    disabled={actionBusy}
                  >
                    <MapPin className="h-4 w-4 text-red-500" />
                    Mark Overdue
                  </Button>
                )}
              </>
            )}
            <Link
              href={`${movementsPath}?studentId=${studentId}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <History className="h-4 w-4 text-muted-foreground" />
              View Movement History
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href={`${basePath}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Back to Students
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Quick Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{leaves.length}</p>
              <p className="text-xs text-muted-foreground">Recent Leaves</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{movements.length}</p>
              <p className="text-xs text-muted-foreground">Movements</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leave History */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Recent Leaves</h3>
          </div>
        </div>
        {leaves.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No leave records found.</p>
        ) : (
          <div className="divide-y divide-border">              {leaves.map((l: { id: string; status: string; startAt: string; endAt: string; leaveTypeName?: string; leaveTypeUiConfig?: Record<string, unknown> | null }) => (
              <Link
                key={l.id}
                href={`${approvalsPath}/${l.id}`}
                className="flex items-center gap-4 px-1 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <LeaveTypeBadge
                    name={l.leaveTypeName ?? "Leave"}
                    color={(l.leaveTypeUiConfig?.color as string | undefined) ?? null}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(l.startAt)} — {formatDate(l.endAt)}
                  </p>
                </div>
                <StatusBadge status={(l.status ?? "").toLowerCase() as "approved" | "pending" | "rejected"} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Movement Timeline */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Movement Timeline</h3>
          </div>
          <Link
            href={`${movementsPath}?studentId=${studentId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No movement events recorded.</p>
        ) : (
          <div className="relative">
            {movements.map((mov: { id: string; eventType: string; fromState: string; toState: string; occurredAt: string }, i: number) => (
              <div key={mov.id} className="relative flex gap-4 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  {i < movements.length - 1 && <div className="h-full w-px bg-border" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{getEventLabel(mov.eventType)}</p>
                  <p className="text-xs text-muted-foreground">
                    {mov.fromState} → {mov.toState}
                    {mov.occurredAt && ` · ${formatDateTime(mov.occurredAt)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Location action confirmation */}
      <AlertDialog
        open={locationAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setLocationAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locationAction ? locationActionCopy[locationAction].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locationAction ? locationActionCopy[locationAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(e) => {
                e.preventDefault();
                if (locationAction) void runLocationAction(locationAction);
              }}
            >
              {actionBusy ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
