import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";

export async function listApprovals(query: ListApprovalsQuery) {
  return leaveApprovalRepository.findByFilters({
    status: query.status as LeaveApprovalDecision | undefined,
    leaveRequestId: query.leaveRequestId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

