import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { type LeaveApproval,leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListExtensionApprovalsQuery } from "@/dto/extension/list-extension-approvals.dto";

export async function listExtensionApprovals(
  query: ListExtensionApprovalsQuery
): Promise<{
  items: Array<LeaveApproval & { approverRoleCode: string | null; extension: { id: string; extensionNumber: number; reason: string; status: string; requestedEndAt: Date; currentEndAt: Date } | null; leaveRequest: { id: string; status: string; requestNumber: string } | null; studentName: string | null; studentRollNumber: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  return leaveApprovalRepository.findExtensionApprovals({
    status: query.status as LeaveApprovalDecision | undefined,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

