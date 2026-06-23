"use client";

import { useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/table/DataTable";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { approveExtension } from "@/lib/api/extension-api";
import { logger } from "@/lib/logger";

type ExtensionApprovalItem = {
  id: string;
  decision: string;
  approverRoleCode: string | null;
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
  leaveRequest: {
    id: string;
    status: string;
    requestNumber: string;
  } | null;
};

type ExtensionApprovalTableProps = {
  approvals: ExtensionApprovalItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onPageChange: (page: number) => void;
  onMutate: () => void;
}

export function ExtensionApprovalTable({
  approvals,
  page,
  totalPages,
  isLoading,
  isError,
  error,
  onPageChange,
  onMutate,
}: ExtensionApprovalTableProps) {
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    action: "approve" | "reject";
    studentName: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      await approveExtension(actionTarget.id, {
        decision: actionTarget.action === "approve" ? LEAVE_APPROVAL_DECISION.APPROVED : LEAVE_APPROVAL_DECISION.REJECTED,
      });
      setActionTarget(null);
      onMutate();
    } catch (err) {
      logger.error("Failed to approve extension", { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "studentName" as keyof ExtensionApprovalItem,
        header: "Student",
        render: (_value: unknown, row: ExtensionApprovalItem) => (
          <div>
            <p className="font-medium">{row.studentName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{row.studentRollNumber ?? ""}</p>
          </div>
        ),
      },
      {
        key: "leaveRequest" as keyof ExtensionApprovalItem,
        header: "Request",
        render: (value: unknown) => {
          const lr = value as ExtensionApprovalItem["leaveRequest"];
          return (
            <span className="font-mono text-xs">{lr?.requestNumber ?? "—"}</span>
          );
        },
      },
      {
        key: "extension" as keyof ExtensionApprovalItem,
        header: "Extension #",
        render: (value: unknown) => {
          const ext = value as ExtensionApprovalItem["extension"];
          return <span className="text-xs">#{ext?.extensionNumber ?? "?"}</span>;
        },
      },
      {
        key: "extension" as keyof ExtensionApprovalItem,
        header: "New End",
        render: (value: unknown) => {
          const ext = value as ExtensionApprovalItem["extension"];
          if (!ext) return "—";
          const d = ext.requestedEndAt instanceof Date ? ext.requestedEndAt : new Date(ext.requestedEndAt);
          return <span className="text-xs text-muted-foreground">{d.toLocaleDateString()}</span>;
        },
      },
      {
        key: "decision" as keyof ExtensionApprovalItem,
        header: "Status",
        render: (value: unknown) => (
          <StatusBadge
            status={(value as string)?.toLowerCase() as "approved" | "pending" | "rejected"}
          />
        ),
      },
      {
        key: "id" as keyof ExtensionApprovalItem,
        header: "Actions",
        render: (_value: unknown, row: ExtensionApprovalItem) => {
          if (row.decision !== LEAVE_APPROVAL_DECISION.PENDING) return null;
          return (
            <div className="flex gap-1">
              <Button
                size="xs"
                onClick={() =>
                  setActionTarget({
                    id: row.extension?.id ?? row.id,
                    action: "approve",
                    studentName: row.studentName ?? "this student",
                  })
                }
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={() =>
                  setActionTarget({
                    id: row.extension?.id ?? row.id,
                    action: "reject",
                    studentName: row.studentName ?? "this student",
                  })
                }
              >
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return approvals.filter((a) => {
      const key = a.extension?.id ?? a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [approvals]);

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load extension approvals"} onRetry={onMutate} />;
  }

  if (isLoading) {
    return <LoadingState count={5} />;
  }

  if (deduped.length === 0) {
    return <EmptyState title="No extension approvals" description="No extension approvals to review." />;
  }

  return (
    <>
      <DataTable
        data={deduped}
        columns={columns}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />

      <ConfirmationDialog
        open={!!actionTarget}
        onOpenChange={() => setActionTarget(null)}
        title={actionTarget?.action === "approve" ? "Approve Extension" : "Reject Extension"}
        description={
          actionTarget?.action === "approve"
            ? `Are you sure you want to approve the extension for ${actionTarget?.studentName}?`
            : `Are you sure you want to reject the extension for ${actionTarget?.studentName}?`
        }
        confirmLabel={actionTarget?.action === "approve" ? "Approve" : "Reject"}
        variant={actionTarget?.action === "approve" ? "default" : "destructive"}
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </>
  );
}
