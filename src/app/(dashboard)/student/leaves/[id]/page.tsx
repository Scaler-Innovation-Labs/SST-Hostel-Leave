"use client";

import { ArrowLeft, Repeat, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
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

  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [extending, setExtending] = useState(false);

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
          : "We couldn't cancel this request"
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

      {isExtendable && <LeaveQrPass leaveId={id} />}

      <AskAQuestionSection leaveId={id} canAnswer />

      <DocumentList
        leaveId={id}
        requiredDocument={
          leave.leaveTypeName?.toUpperCase().includes("MEDICAL")
            ? { type: "MEDICAL_CERTIFICATE", label: "Medical certificate" }
            : undefined
        }
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
