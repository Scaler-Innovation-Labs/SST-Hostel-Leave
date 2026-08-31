import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import {
  Badge,
  LEAVE_STATUS_PRESENTATION,
  StatusBadge,
  TECH_LABEL,
} from "@/design-system/sst";
import { formatDateTime, getDurationLabel } from "@/lib/date-utils";

import { LeaveTypeIcon } from "./LeaveTypeIcon";

export type PolicyCheck = {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
};

/**
 * Which approver the request is sitting with. The chain is configuration, so
 * this only names the steps the workflow actually defines.
 */
function waitingOn(stepKey: string | null): string | null {
  const key = (stepKey ?? "").toUpperCase();
  if (
    !key ||
    key === VIEW_STEP_KEY.POLICY ||
    key === VIEW_STEP_KEY.SUBMITTED ||
    key === VIEW_STEP_KEY.COMPLETE
  ) {
    return null;
  }
  if (key.includes("PARENT")) return "a parent";
  if (key.includes("POC")) return "the POC";
  if (key.includes("ADMIN")) return "an admin";
  return null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={TECH_LABEL}>{label}</dt>
      <dd className="mt-0.5 text-body font-medium text-ink">{value}</dd>
    </div>
  );
}

/**
 * The facts of the request: what kind of leave, when, where, and where it has
 * got to. The status badge carries the state; the card itself stays neutral.
 */
export function LeaveSummary({ leave }: { leave: Record<string, unknown> }) {
  const rawStatus = (leave.status as string) ?? "";
  const presentation =
    LEAVE_STATUS_PRESENTATION[rawStatus.toUpperCase() as LeaveRequestStatus] ??
    LEAVE_STATUS_PRESENTATION.PENDING;

  const leaveTypeName = (leave.leaveTypeName as string) ?? "Leave";
  const destination = leave.destination as string | undefined;
  const reason = leave.reason as string | undefined;
  const checks = (leave.policyResult as { checks?: PolicyCheck[] } | null)
    ?.checks ?? [];
  const passed = checks.filter((check) => check.passed).length;
  const allPassed = checks.length > 0 && passed === checks.length;
  const pendingWith =
    rawStatus.toUpperCase() === "PENDING"
      ? waitingOn((leave.currentStepKey as string | null) ?? null)
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
            <LeaveTypeIcon name={leaveTypeName} className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-h3 text-ink">{leaveTypeName}</h2>
              <StatusBadge status={presentation} />
            </div>

            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Start" value={formatDateTime(leave.startAt as string)} />
              <Fact label="End" value={formatDateTime(leave.endAt as string)} />
              <Fact
                label="Duration"
                value={getDurationLabel(
                  leave.startAt as string,
                  leave.endAt as string
                )}
              />
              {destination && <Fact label="Destination" value={destination} />}
            </dl>

            {(pendingWith || checks.length > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {pendingWith && (
                  <Badge tone="warning">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden />
                    Waiting on {pendingWith}
                  </Badge>
                )}
                {checks.length > 0 && (
                  <Badge tone={allPassed ? "success" : "danger"}>
                    {allPassed ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    <span className="tabular-nums">
                      {passed} of {checks.length}
                    </span>{" "}
                    policy checks passed
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className={TECH_LABEL}>Request</p>
          <p className="mt-0.5 font-mono text-body text-ink">
            {(leave.requestNumber as string) ??
              (leave.id as string)?.slice(0, 8) ??
              "—"}
          </p>
        </div>
      </div>

      {reason && (
        <div className="border-t border-border bg-surface-sunken px-6 py-4">
          <p className={TECH_LABEL}>Reason</p>
          <p className="mt-1 text-body leading-relaxed text-ink">{reason}</p>
        </div>
      )}
    </section>
  );
}
