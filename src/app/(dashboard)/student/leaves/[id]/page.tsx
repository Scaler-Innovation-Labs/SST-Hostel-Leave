"use client";

import { AlertTriangle, ArrowLeft, Clock, Repeat, X, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { PARENT_APPROVAL_TOKEN_EXPIRY_HOURS } from "@/constants/parent/parent-approval";
import { ROUTES } from "@/constants/routes";
import {
  Button,
  ErrorState,
  LEAVE_STATUS_PRESENTATION,
  Masthead,
  RowSkeleton,
  SectionCard,
  Skeleton,
} from "@/design-system/sst";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { ExtensionForm } from "@/features/extensions/components/ExtensionForm";
import { AskAQuestionSection } from "@/features/leaves/components/AskAQuestionSection";
import { DocumentList } from "@/features/leaves/components/DocumentList";
import { LeaveExtensionsList } from "@/features/leaves/components/LeaveExtensionsList";
import { LeaveQrPass } from "@/features/leaves/components/LeaveQrPass";
import { LeaveSummary } from "@/features/leaves/components/LeaveSummary";
import { LeaveTimeline } from "@/features/leaves/components/LeaveTimeline";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { cancelLeave } from "@/lib/api/leave-api";

export default function StudentLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { leave, isLoading, isError, mutate } = useLeave(id);
  const { approvals } = useApprovalChain(id);
  const rejectingApproval = approvals.find((a) => a.decision?.toLowerCase() === "rejected");
  const parentApproval = approvals.find(
    (a) =>
      a.stepKey?.toUpperCase().includes("PARENT") ||
      a.approverRoleCode?.toUpperCase().includes("PARENT")
  );

  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [extending, setExtending] = useState(false);
  const [now] = useState(() => Date.now());

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelLeave(id);
      toast.success("Leave request cancelled");
      await mutate();
      setShowCancel(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't cancel this request",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <RowSkeleton rows={3} />
      </div>
    );
  }

  if (isError || !leave) {
    return (
      <ErrorState
        title="We couldn't open this leave request"
        description="It may have been withdrawn, or the link may be out of date. Your other requests are unaffected."
        onRetry={() => router.push(ROUTES.STUDENT_LEAVES)}
        retryLabel="Back to my leaves"
      />
    );
  }

  const status = (leave.status as string)?.toUpperCase();
  const isApproved = status === LEAVE_REQUEST_STATUS.APPROVED;
  // An overdue leave can still be extended — the overdue notice asks the
  // student to do exactly that — but it can no longer be cancelled.
  const isOverdue = status === LEAVE_REQUEST_STATUS.OVERDUE;
  const isPending = status === LEAVE_REQUEST_STATUS.PENDING;
  const isExtendable = isApproved || isOverdue;
  const isCancellable = isPending || isApproved;

  const isParentStep = Boolean(
    (leave.currentStepKey as string | null)?.toUpperCase().includes("PARENT")
  );
  const isParentPending =
    isPending &&
    (parentApproval?.decision?.toLowerCase() === "pending" || isParentStep);

  const parentCreatedAt = parentApproval?.createdAt
    ? new Date(parentApproval.createdAt).getTime()
    : leave.submittedAt
      ? new Date(leave.submittedAt as string).getTime()
      : null;

  const isParentExpired =
    isParentPending &&
    parentCreatedAt !== null &&
    now - parentCreatedAt > PARENT_APPROVAL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

  const presentation =
    LEAVE_STATUS_PRESENTATION[status as LeaveRequestStatus] ??
    LEAVE_STATUS_PRESENTATION.PENDING;

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow={`Request ${leave.requestNumber ?? (leave.id as string)?.slice(0, 8)}`}
        title={(leave.leaveTypeName as string) ?? "Leave request"}
        status={{ label: presentation.label, tone: presentation.tone }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="onDark"
              size="sm"
              onClick={() => router.push(ROUTES.STUDENT_LEAVES)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              My leaves
            </Button>
            {isExtendable && (
              <Button
                variant="onDark"
                size="sm"
                onClick={() => setExtending(!extending)}
              >
                <Repeat className="h-4 w-4" aria-hidden />
                {extending ? "Close" : "Request extension"}
              </Button>
            )}
            {isCancellable && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowCancel(true)}
              >
                <X className="h-4 w-4" aria-hidden />
                Cancel request
              </Button>
            )}
          </div>
        }
      />

      {status === LEAVE_REQUEST_STATUS.REJECTED && (
        <div className="rounded-2xl border border-danger/30 bg-danger-light p-5 text-ink shadow-sm">
          <div className="flex items-start gap-3.5">
            <XCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-body font-semibold text-danger">Leave Request Rejected</h3>
              {rejectingApproval?.rejectionCategory && (
                <p className="text-caption font-medium text-ink">
                  Reason category: <span className="capitalize">{rejectingApproval.rejectionCategory.replace(/_/g, " ")}</span>
                </p>
              )}
              {rejectingApproval?.comments && (
                <p className="text-body text-ink/90 italic mt-1">
                  &ldquo;{rejectingApproval.comments}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isParentPending && (
        <div
          className={`rounded-2xl border p-5 text-ink shadow-sm ${
            isParentExpired
              ? "border-danger/30 bg-danger-light"
              : "border-warning/30 bg-warning-light"
          }`}
        >
          <div className="flex items-start gap-3.5">
            {isParentExpired ? (
              <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3
                className={`text-body font-semibold ${
                  isParentExpired ? "text-danger" : "text-ink"
                }`}
              >
                {isParentExpired
                  ? "Parent Approval Link Expired"
                  : "Parent Approval Pending"}
              </h3>
              <p className="text-caption text-ink/80 leading-relaxed">
                {isParentExpired ? (
                  <>
                    The approval link sent to your parent{parentApproval?.approverName ? ` (${parentApproval.approverName})` : ""} has expired ({PARENT_APPROVAL_TOKEN_EXPIRY_HOURS}-hour lifespan limit). Please contact your hostel warden or administration to request a re-issue or override.
                  </>
                ) : (
                  <>
                    An approval link was sent to your parent{parentApproval?.approverName ? ` (${parentApproval.approverName})` : ""} via SMS. Approval links have a short lifespan and <strong className="font-semibold text-ink">expire within {PARENT_APPROVAL_TOKEN_EXPIRY_HOURS} hours</strong>. Please remind them to review and approve before the link expires.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <LeaveSummary leave={leave as unknown as Record<string, unknown>} />

      {extending && (
        <SectionCard Icon={Repeat} title="Request an extension">
          <ExtensionForm
            leaveId={id}
            currentEndAt={leave.endAt as string}
            onSuccess={() => {
              setExtending(false);
              mutate();
            }}
            onCancel={() => setExtending(false)}
          />
        </SectionCard>
      )}

      <LeaveTimeline
        leaveId={id}
        leave={leave as unknown as Record<string, unknown>}
      />

      {isExtendable && leave.qrMode !== "NONE" && (
        <LeaveQrPass leaveId={id} qrMode={leave.qrMode} />
      )}

      <AskAQuestionSection leaveId={id} canAnswer />

      <DocumentList
        leaveId={id}
        canUpload={isPending}
        canDelete={isPending}
        requiredDocuments={leave.requiredDocuments
          .filter((document) => document.required)
          .map((document) => ({ type: document.code, label: document.label }))}
      />

      <LeaveExtensionsList leaveId={id} />

      <ConfirmationDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel this leave request?"
        consequence={
          isApproved
            ? "Your approval is withdrawn and your gate pass stops working immediately. You'd have to submit a new request and go through approval again."
            : "The request is withdrawn before anyone decides on it. You'd have to submit a new one from scratch."
        }
        confirmLabel="Cancel request"
        dismissLabel="Keep it"
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </div>
  );
}
