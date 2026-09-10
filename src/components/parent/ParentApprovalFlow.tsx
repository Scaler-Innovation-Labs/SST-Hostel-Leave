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

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { Button, Textarea } from "@/design-system/sst";
import { initialsOf } from "@/design-system/sst";
import { formatDate } from "@/lib/date-utils";

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
  const initials = initialsOf(leaveData.studentName);

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
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div
            className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-full ${
              approved
                ? "bg-success-light text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {approved ? (
              <CheckCircle2 className="size-9" />
            ) : (
              <XCircle className="size-9" />
            )}
          </div>
          <h1 className="text-h2 font-semibold text-ink">
            Response Recorded
          </h1>
          <p className="mt-2 text-muted">
            You have{" "}
            <span
              className={
                approved
                  ? "font-medium text-success"
                  : "font-medium text-danger"
              }
            >
              {approved ? "approved" : "rejected"}
            </span>{" "}
            {leaveData.studentName}&apos;s{" "}
            {isExtension ? "extension request" : "leave request"}.
          </p>
          <p className="mt-6 text-body text-muted/70">
            You can close this page. The school has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl px-4">
        {/* Brand header */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-body font-semibold text-on-fill">
            SST
          </div>
          <div className="text-left">
            <p className="text-body font-semibold text-ink">
              Scaler School of Technology
            </p>
            <p className="text-caption text-muted">
              Student Leave Approval
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {/* Card header */}
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-h3 font-semibold text-ink">
                <ClipboardList className="size-5 shrink-0 text-muted" />
                {isExtension ? "Leave Extension Request" : "Leave Request Details"}
              </h1>
              {isExtension && (
                <p className="mt-0.5 text-body text-muted">
                  Extension #{leaveData.extensionNumber}
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-3 py-1 text-caption font-medium text-warning ring-1 ring-warning/20">
              <span className="size-1.5 rounded-full bg-warning" />
              Pending Review
            </span>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-lg bg-danger/10 px-4 py-3 text-body text-danger">
              {error}
            </div>
          )}

          <div className="px-6 py-5">
            {/* Student */}
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-body font-semibold text-on-fill">
                {initials || "S"}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {leaveData.studentName}
                </p>
                <p className="text-body text-muted">
                  Roll No. {leaveData.studentRollNumber}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {/* Leave type */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Tag className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-body text-muted">Leave type</p>
                  <p className="font-medium text-ink">
                    {leaveData.leaveTypeName || "—"}
                  </p>
                  {leaveData.leaveTypeDescription && (
                    <p className="mt-1 text-body text-muted">
                      {leaveData.leaveTypeDescription}
                    </p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <CalendarDays className="size-4" />
                </div>
                <div className="min-w-0">
                  {isExtension ? (
                    <>
                      <p className="text-body text-muted">
                        Current end date
                      </p>
                      <p className="font-medium text-ink">
                        {formatDate(leaveData.leaveStartDate)}
                      </p>
                      <p className="mt-2 text-body text-muted">
                        Requested new end date
                      </p>
                      <p className="font-medium text-ink">
                        {formatDate(leaveData.leaveEndDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-body text-muted">
                        Leave dates
                      </p>
                      <p className="font-medium text-ink">
                        {formatDate(leaveData.leaveStartDate)} –{" "}
                        {formatDate(leaveData.leaveEndDate)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <MessageSquareText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-body text-muted">
                    {isExtension ? "Extension reason" : "Reason"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink">
                    {leaveData.leaveReason || "—"}
                  </p>
                </div>
              </div>

              {/* Submitted form */}
              {leaveData.submittedForm &&
                Object.keys(leaveData.submittedForm).length > 0 && (
                  <div className="rounded-xl bg-surface-sunken p-4 ring-1 ring-border">
                    <p className="mb-3 text-caption font-semibold uppercase tracking-wide text-muted">
                      Additional details
                    </p>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {Object.entries(leaveData.submittedForm).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt className="text-caption text-muted">
                              {formatFieldLabel(key)}
                            </dt>
                            <dd className="text-body font-medium text-ink">
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
                className="mb-1.5 block text-body font-medium text-ink"
              >
                Comments (optional)
              </label>
              <Textarea
                id="parent-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Anything you'd like the hostel to know (optional)."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-5 border-t border-border bg-surface-sunken/40 px-6 py-5 sm:flex-row">
            <Button
              size="lg"
              variant="success"
              className="flex-1"
              onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.APPROVED)}
              disabled={submitting}
              loading={submitting && decision === LEAVE_APPROVAL_DECISION.APPROVED}
              loadingText="Sending…"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Give permission
            </Button>

            <Button
              size="lg"
              variant="danger"
              className="flex-1"
              onClick={() => handleDecision(LEAVE_APPROVAL_DECISION.REJECTED)}
              disabled={submitting}
              loading={submitting && decision === LEAVE_APPROVAL_DECISION.REJECTED}
              loadingText="Sending…"
            >
              <XCircle className="h-5 w-5" aria-hidden />
              Don&apos;t allow
            </Button>
          </div>
        </div>

        {/* Trust footer */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-caption text-muted">
          <ShieldCheck className="size-3.5" />
          This is a secure link shared only with you.
        </p>
      </div>
    </div>
  );
}

export default ParentApprovalFlow;
