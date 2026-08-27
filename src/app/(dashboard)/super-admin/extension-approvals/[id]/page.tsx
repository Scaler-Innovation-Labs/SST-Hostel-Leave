"use client";

import { useParams, useRouter } from "next/navigation";

import { ExtensionDetailWorkspace } from "@/features/extensions/components/ExtensionDetailWorkspace";
import { LoadingState } from "@/components/shared/LoadingState";
import { fetcher } from "@/lib/api/fetcher";
import useSWR from "swr";
import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";

function transformToExtensionCardItem(item: ApprovalQueueItem) {
  return {
    id: item.id,
    decision: item.decision,
    approverRoleCode: item.approverRoleCode,
    studentName: item.studentName,
    studentRollNumber: item.studentRollNumber,
    createdAt: item.createdAt,
    extension: item.leaveExtensionId
      ? {
          id: item.leaveExtensionId,
          extensionNumber: 1,
          reason: item.leaveRequest?.submittedForm?.reason as string ?? "—",
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

export default function SuperAdminExtensionApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useSWR<{ items: any[] }>(
    `/api/v1/extensions/approvals?search=${id}`,
    fetcher
  );

  const item = data?.items?.find((item: any) => item.id === id || item.leaveRequest?.id === id);
  const transformedItem = item ? transformToExtensionCardItem(item) : null;

  if (isLoading) {
    return <LoadingState count={3} />;
  }

  if (error || !transformedItem) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <p className="text-base font-medium">Extension approval not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The extension approval may have been removed or you don't have access to it.
        </p>
        <button
          type="button"
          onClick={() => router.push("/super-admin/extension-approvals")}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <ExtensionDetailWorkspace
      item={transformedItem}
      onBack={() => router.push("/super-admin/extension-approvals")}
      onActionComplete={() => {}}
    />
  );
}