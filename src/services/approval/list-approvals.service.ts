import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listApprovals(query: ListApprovalsQuery, currentUser: CurrentUser) {
  if (query.leaveRequestId) {
    const leave = await leaveRepository.findById(query.leaveRequestId);
    if (leave) {
      await verifyStudentOwnership(currentUser, leave.studentId);
    }
  }

  return leaveApprovalRepository.findByFilters({
    status: query.status as LeaveApprovalDecision | undefined,
    leaveRequestId: query.leaveRequestId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    search: query.search,
    excludeLeaveStatuses: [LEAVE_REQUEST_STATUS.CANCELLED],
    page: query.page,
    limit: query.limit,
  });
}

