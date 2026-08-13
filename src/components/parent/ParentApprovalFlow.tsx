"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  ShieldCheck,
  Tag,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

type LeaveData = {
  approvalId: string;
  targetType: "LEAVE_REQUEST" | "LEAVE_EXTENSION";
  leaveRequestId: string;
  leaveExtensionId: string | null;
  extensionNumber: number | null;
  studentName: string;
  studentRollNumber: string;
  leaveTypeName: string;
  leaveTypeDescription: string;
  leaveReason: string;
  leaveStartDate: string;
  leaveEndDate: string;
  submittedForm: Record<string, unknown> | null;
  parentName: string;
  parentPhone: string;
};

type Props = {
  token: string;
  leaveData: LeaveData;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatFieldLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}

export function ParentApprovalFlow({ token, leaveData }: Props) {
  const [error, setError] = useState<string>("");
  const [decision, setDecision] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [comments, setComments] = useState<string>("");

  const isExtension = leaveData.targetType === "LEAVE_EXTENSION";
  const initials = getInitials(leaveData.studentName);

  const handleDecision = async (dec: string) => {
    setDecision(dec);
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/parent-approve/${token}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: dec,
            comments: comments || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to submit decision");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const approved = decision === LEAVE_APPROVAL_DECISION.APPROVED;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div
            className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-full ${
              approved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {approved ? (
              <CheckCircle2 className="size-9" />
            ) : (
              <XCircle className="size-9" />
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Response Recorded
          </h1>
          <p className="mt-2 text-muted-foreground">
            You have{" "}
            <span
              className={
                approved
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-destructive"
              }
            >
              {approved ? "approved" : "rejected"}
            </span>{" "}
            {leaveData.studentName}&apos;s{" "}
            {isExtension ? "extension request" : "leave request"}.
          </p>
          <p className="mt-6 text-sm text-muted-foreground/70">
            You can close this page. The school has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl px-4">
        {/* Brand header */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            SST
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">
              Scaler School of Technology
            </p>
            <p className="text-xs text-muted-foreground">
              Student Leave Approval
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Card header */}
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ClipboardList className="size-5 shrink-0 text-muted-foreground" />
                {isExtension ? "Leave Extension Request" : "Leave Request Details"}
              </h1>
              {isExtension && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Extension #{leaveData.extensionNumber}
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Pending Review
            </span>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="px-6 py-5">
            {/* Student */}
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials || "S"}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {leaveData.studentName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Roll No. {leaveData.studentRollNumber}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {/* Leave type */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Leave type</p>
                  <p className="font-medium text-foreground">
                    {leaveData.leaveTypeName || "—"}
                  </p>
                  {leaveData.leaveTypeDescription && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {leaveData.leaveTypeDescription}
                    </p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="size-4" />
                </div>
                <div className="min-w-0">
                  {isExtension ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Current end date
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(leaveData.leaveStartDate)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Requested new end date
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(leaveData.leaveEndDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Leave dates
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(leaveData.leaveStartDate)} –{" "}
                        {formatDate(leaveData.leaveEndDate)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquareText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {isExtension ? "Extension reason" : "Reason"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {leaveData.leaveReason || "—"}
                  </p>
                </div>
              </div>

              {/* Submitted form */}
              {leaveData.submittedForm &&
                Object.keys(leaveData.submittedForm).length > 0 && (
                  <div className="rounded-xl bg-muted p-4 ring-1 ring-border">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Additional details
                    </p>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {Object.entries(leaveData.submittedForm).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt className="text-xs text-muted-foreground">
                              {formatFieldLabel(key)}
                            </dt>
                            <dd className="text-sm font-medium text-foreground">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </dd>
                          </div>
                        )
                      )}
                    </dl>
                  </div>
                )}
            </div>

            {/* Comments */}
            <div className="mt-6">
              <label
                htmlFor="parent-comments"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Comments (optional)
              </label>
              <textarea
                id="parent-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add any comments..."
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-6 py-5 sm:flex-row">
            <Button
              onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.APPROVED)}
              disabled={submitting}
              className="flex-1 py-2.5"
            >
              <CheckCircle2 />
              {submitting && decision === LEAVE_APPROVAL_DECISION.APPROVED
                ? "Submitting..."
                : "Approve"}
            </Button>

            <Button
              onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.REJECTED)}
              disabled={submitting}
              variant="destructive"
              className="flex-1 py-2.5"
            >
              <XCircle />
              {submitting && decision === LEAVE_APPROVAL_DECISION.REJECTED
                ? "Submitting..."
                : "Reject"}
            </Button>
          </div>
        </div>

        {/* Trust footer */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          This is a secure link shared only with you.
        </p>
      </div>
    </div>
  );
}

export default ParentApprovalFlow;
