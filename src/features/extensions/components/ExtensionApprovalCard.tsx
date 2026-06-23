"use client";

import { ExtensionStatusBadge } from "./ExtensionStatusBadge";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";

type ExtensionApprovalItem = {
  id: string;
  decision: string;
  studentName: string | null;
  studentRollNumber: string | null;
  extension: {
    id: string;
    extensionNumber: number;
    reason: string;
    status: string;
    requestedEndAt: Date;
    currentEndAt: Date;
  } | null;
};

interface ExtensionApprovalCardProps {
  approval: ExtensionApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

export function ExtensionApprovalCard({
  approval,
  onApprove,
  onReject,
  loading,
}: ExtensionApprovalCardProps) {
  const ext = approval.extension;
  const isPending = approval.decision === LEAVE_APPROVAL_DECISION.PENDING;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{approval.studentName ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{approval.studentRollNumber}</p>
        </div>
        <ExtensionStatusBadge
          status={approval.decision.toLowerCase() as "pending" | "approved" | "rejected"}
        />
      </div>
      {ext && (
        <div className="mt-2 space-y-1 text-sm">
          <p>Extension #{ext.extensionNumber}</p>
          <p className="text-muted-foreground">Reason: {ext.reason}</p>
          <p className="text-muted-foreground">
            New end: {new Date(ext.requestedEndAt).toLocaleDateString()}
          </p>
        </div>
      )}
      {isPending && (
        <div className="mt-3 flex gap-2">
          <Button size="xs" onClick={() => onApprove(approval.extension?.id ?? approval.id)} disabled={loading}>
            Approve
          </Button>
          <Button size="xs" variant="destructive" onClick={() => onReject(approval.extension?.id ?? approval.id)} disabled={loading}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
