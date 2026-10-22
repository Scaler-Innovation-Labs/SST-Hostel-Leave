"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { ErrorState, RowSkeleton } from "@/design-system/sst";
import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";
import type { ExtensionCardItem } from "@/features/extensions/components/ExtensionCard";
import { ExtensionDetailWorkspace } from "@/features/extensions/components/ExtensionDetailWorkspace";
import { fetcher } from "@/lib/api/fetcher";

function transformToExtensionCardItem(item: ApprovalQueueItem): ExtensionCardItem {
  const ext = item.extension;
  return {
    id: item.id,
    decision: item.decision,
    approverRoleCode: item.approverRoleCode,
    studentName: item.studentName,
    studentRollNumber: item.studentRollNumber,
    createdAt: item.createdAt,
    extension: ext
      ? {
          id: ext.id,
          extensionNumber: ext.extensionNumber ?? 1,
          reason: ext.reason || (item.leaveRequest?.reason as string) || "—",
          status: ext.status || item.decision.toLowerCase(),
          requestedEndAt: ext.requestedEndAt ?? item.leaveRequest?.endAt ?? "",
          currentEndAt: ext.currentEndAt ?? item.leaveRequest?.startAt ?? "",
        }
      : item.leaveExtensionId
      ? {
          id: item.leaveExtensionId,
          extensionNumber: 1,
          reason: (item.leaveRequest?.reason as string) || (item.leaveRequest?.submittedForm?.reason as string) || "—",
          status: item.decision.toLowerCase(),
          requestedEndAt: item.leaveRequest?.endAt ?? "",
          currentEndAt: item.leaveRequest?.startAt ?? "",
        }
      : null,
    leaveRequest: item.leaveRequest
      ? {
          id: item.leaveRequest.id,
          status: item.leaveRequest.status,
          requestNumber: item.leaveRequest.requestNumber,
        }
      : null,
  };
}

type ExtensionApprovalDetailViewProps = {
  backRoute: string;
};

export function ExtensionApprovalDetailView({ backRoute }: ExtensionApprovalDetailViewProps) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useSWR<{ items: ApprovalQueueItem[] }>(
    id ? `/api/v1/extensions/approvals?search=${encodeURIComponent(id)}` : null,
    fetcher
  );

  const item = data?.items?.find(
    (candidate) =>
      candidate.id === id ||
      candidate.leaveRequest?.id === id ||
      candidate.leaveExtensionId === id
  );
  const transformedItem = item ? transformToExtensionCardItem(item) : null;

  const backToQueue = () => router.push(backRoute);

  if (isLoading) {
    return <RowSkeleton rows={3} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load this extension request"
        description="The request didn't come back from the server. Try again, or go back to the queue."
        onRetry={() => router.refresh()}
      />
    );
  }

  if (!transformedItem) {
    return (
      <ErrorState
        title="This extension request no longer exists"
        description="It was withdrawn or already decided. The queue shows what is still waiting on you."
        onRetry={backToQueue}
        retryLabel="Back to the queue"
      />
    );
  }

  return (
    <ExtensionDetailWorkspace
      item={transformedItem}
      onBack={backToQueue}
      onActionComplete={() => {
        router.refresh();
      }}
    />
  );
}
