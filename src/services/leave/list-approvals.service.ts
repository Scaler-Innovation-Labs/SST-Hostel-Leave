import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { type LeaveApproval,leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted, verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listApprovals(
  query: ListApprovalsQuery,
  currentUser: CurrentUser
): Promise<{
  items: Array<LeaveApproval & { approverRoleCode: string | null; leaveRequest: { id: string; status: string; startAt: Date; endAt: Date; reason: string; requestNumber: string; submittedForm?: Record<string, unknown> | null; currentStepKey?: string | null; currentStepOrder?: number | null; policyResult?: Record<string, unknown> | null } | null; studentName: string | null; studentRollNumber: string | null; roomNumber: string | null; hostelName: string | null; departmentName: string | null; leaveTypeName: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  if (query.leaveRequestId) {
    const leave = await leaveRepository.findById(query.leaveRequestId);
    if (leave) {
      await verifyStudentOwnership(currentUser, leave.studentId);
    }
  }

  const isPoc = currentUser.roles.includes(ROLES.POC);

  // Staff visibility: HOSTEL-scoped roles see only approvals for students
  // in their hostels. No scopes = unrestricted (ALL).
  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  return leaveApprovalRepository.findByFilters({
    status: query.status as LeaveApprovalDecision | undefined,
    leaveRequestId: query.leaveRequestId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    search: query.search,
    waitingOn: query.waitingOn,
    hostelId: query.hostelId,
    hostelIds,
    leaveTypeId: query.leaveTypeId,
    approverUserId: isPoc ? currentUser.id : undefined,
    excludeLeaveStatuses: [LEAVE_REQUEST_STATUS.CANCELLED],
    page: query.page,
    limit: query.limit,
  });
}
