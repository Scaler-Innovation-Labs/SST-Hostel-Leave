import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
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
  items: Array<LeaveApproval & { approverRoleCode: string | null; leaveRequest: { id: string; status: string; startAt: Date; endAt: Date; reason: string; requestNumber: string; submittedForm?: Record<string, unknown> | null; currentStepKey?: string | null; currentStepOrder?: number | null; policyResult?: Record<string, unknown> | null } | null; studentName: string | null; studentRollNumber: string | null; roomNumber: string | null; hostelName: string | null; departmentName: string | null; leaveTypeName: string | null; workflowSteps?: Array<{ stepKey: string; stepOrder: number; approverRoleCode: string | null; isParentApproval: boolean | null; approvalMethod: string | null }> }>;
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

  // When a specific leave is requested (approval chain / detail view), return
  // the FULL chain — every step including parent rows and already-decided
  // rows. The POC action-queue defaults (their pending rows only) apply ONLY
  // to the list/dashboard view, otherwise the detail view would mistake the
  // POC row for the current step while the server acts on the parent row.
  const isChainRequest = !!query.leaveRequestId;

  // Staff visibility: HOSTEL-scoped roles see only approvals for students
  // in their hostels. No scopes = unrestricted (ALL).
  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  // A POC queue is an action queue: default to only their pending approvals,
  // so items the POC already acted on drop out of the dashboard list.
  const effectiveStatus =
    query.status as LeaveApprovalDecision | undefined ??
    (isPoc && !isChainRequest ? LEAVE_APPROVAL_DECISION.PENDING : undefined);

  return leaveApprovalRepository.findByFilters({
    status: effectiveStatus,
    leaveRequestId: query.leaveRequestId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    search: query.search,
    waitingOn: query.waitingOn,
    hostelId: query.hostelId,
    hostelIds,
    leaveTypeId: query.leaveTypeId,
    approverUserId: isPoc && !isChainRequest ? currentUser.id : undefined,
    excludeLeaveStatuses: isChainRequest ? undefined : [LEAVE_REQUEST_STATUS.CANCELLED],
    page: query.page,
    limit: query.limit,
  });
}
