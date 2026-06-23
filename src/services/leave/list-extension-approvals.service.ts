import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListExtensionApprovalsQuery } from "@/dto/extension/list-extension-approvals.dto";

export async function listExtensionApprovals(query: ListExtensionApprovalsQuery) {
  return leaveApprovalRepository.findExtensionApprovals({
    status: query.status as LeaveApprovalDecision | undefined,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

