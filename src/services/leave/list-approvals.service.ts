import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import {
  LEAVE_REQUEST_STATUS,
  LEAVE_REQUEST_STATUSES,
  type LeaveRequestStatus,
} from "@/constants/leave/leave-status";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import {
  type LeaveApproval,
  leaveApprovalRepository,
} from "@/db/repositories/leave/leave-approval.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/errors";
import {
  assertCanAccessLeave,
  getScopedHostelIds,
  isStaffScopeRestricted,
} from "@/services/shared/authorization.service";
import type { ApprovalStepBreakdownEntry } from "@/types/leave/approval-step-breakdown";

export async function listApprovals(
  query: ListApprovalsQuery,
  currentUser: CurrentUser,
): Promise<{
  items: Array<
    LeaveApproval & {
      approverRoleCode: string | null;
      leaveRequest: {
        id: string;
        status: string;
        startAt: Date;
        endAt: Date;
        reason: string;
        requestNumber: string;
        submittedForm?: Record<string, unknown> | null;
        currentStepKey?: string | null;
        currentStepOrder?: number | null;
        policyResult?: Record<string, unknown> | null;
      } | null;
      studentName: string | null;
      studentRollNumber: string | null;
      roomNumber: string | null;
      hostelName: string | null;
      departmentName: string | null;
      leaveTypeName: string | null;
      workflowSteps?: Array<{
        stepKey: string;
        stepOrder: number;
        approverRoleCode: string | null;
        isParentApproval: boolean | null;
        approvalMethod: string | null;
      }>;
    }
  >;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stepBreakdown: ApprovalStepBreakdownEntry[];
}> {
  // Student scope is FORCED (same pattern as listLeaves): without this,
  // an unfiltered student list call would return every student's
  // approval-chain metadata. Staff scoping stays hostel-based below.
  let forcedStudentId: string | undefined;
  if (currentUser.roles.includes(ROLES.STUDENT)) {
    const student = await studentRepository.findByUserId(currentUser.id);
    if (!student) {
      throw new AuthorizationError("Student profile not found");
    }
    forcedStudentId = student.id;
  }

  if (query.leaveRequestId) {
    const leave = await leaveRepository.findById(query.leaveRequestId);
    if (leave) {
      // Scope-aware (not verifyStudentOwnership): hostel-scoped staff get
      // 403 cross-hostel instead of a silent empty list, and students are
      // confined to their own leaves even before the forced filter below.
      await assertCanAccessLeave(currentUser, leave);
    }
  }

  // Staff can hold multiple roles. An ADMIN or SUPER_ADMIN who also has POC
  // membership must retain the broader staff queue instead of being narrowed
  // to leave rows explicitly assigned to them as a POC.
  const isPocOnly =
    currentUser.roles.includes(ROLES.POC) &&
    !currentUser.roles.includes(ROLES.ADMIN) &&
    !currentUser.roles.includes(ROLES.SUPER_ADMIN);

  // When a specific leave is requested (approval chain / detail view), return
  // the FULL chain — every step including parent rows and already-decided
  // rows. The POC action-queue defaults (their pending rows only) apply ONLY
  // to the list/dashboard view, otherwise the detail view would mistake the
  // POC row for the current step while the server acts on the parent row.
  const isChainRequest = !!query.leaveRequestId;

  // Staff visibility: HOSTEL-scoped roles see only approvals for students
  // in their hostels. No scopes = unrestricted (ALL).
  const hostelIds = isStaffScopeRestricted(currentUser)
    ? getScopedHostelIds(currentUser)
    : undefined;

  // A POC queue is an action queue: default to only their pending approvals,
  // so items the POC already acted on drop out of the dashboard list.
  const requestedLeaveStatus = LEAVE_REQUEST_STATUSES.includes(
    query.status as LeaveRequestStatus,
  )
    ? (query.status as LeaveRequestStatus)
    : undefined;
  const effectiveApprovalStatus =
    isPocOnly && !isChainRequest && !requestedLeaveStatus
      ? LEAVE_APPROVAL_DECISION.PENDING
      : undefined;

  return leaveApprovalRepository.findByFilters({
    status: effectiveApprovalStatus,
    leaveStatus: requestedLeaveStatus,
    leaveRequestId: query.leaveRequestId,
    studentId: forcedStudentId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    search: query.search,
    waitingOn: query.waitingOn,
    hostelId: query.hostelId,
    hostelIds,
    leaveTypeId: query.leaveTypeId,
    approverUserId: isPocOnly && !isChainRequest ? currentUser.id : undefined,
    // Admin queues provide full oversight, including CANCELLED requests. A
    // POC-only queue remains focused on actionable work by hiding them.
    excludeLeaveStatuses: query.status
      ? undefined
      : isPocOnly
        ? [LEAVE_REQUEST_STATUS.CANCELLED]
        : undefined,
    // A chain request wants every step of one leave; the queue wants one
    // card per leave, paginated over leaves.
    groupByLeaveRequest: !isChainRequest,
    page: query.page,
    limit: query.limit,
  });
}
