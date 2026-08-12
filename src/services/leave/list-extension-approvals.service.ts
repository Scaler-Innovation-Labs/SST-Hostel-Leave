import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { type LeaveApproval, leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListExtensionApprovalsQuery } from "@/dto/extension/list-extension-approvals.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function listExtensionApprovals(
  query: ListExtensionApprovalsQuery,
  currentUser: CurrentUser
): Promise<{
  items: Array<
    LeaveApproval & {
      approverRoleCode: string | null;
      workflowSteps: Array<{
        stepKey: string;
        stepOrder: number;
        approverRoleCode: string | null;
        isParentApproval: boolean | null;
        approvalMethod: string | null;
      }>;
      leaveTypeName: string | null;
      leaveTypeUiConfig: Record<string, unknown> | null;
      roomNumber: string | null;
      hostelName: string | null;
      departmentName: string | null;
      studentName: string | null;
      studentRollNumber: string | null;
      parentName: string | null;
      parentPhone: string | null;
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
    }
  >;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: { total: number; pending: number; approved: number; rejected: number };
}> {
  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  return leaveApprovalRepository.findExtensionApprovals({
    status: query.status as LeaveRequestStatus | undefined,
    search: query.search,
    waitingOn: query.waitingOn,
    hostelId: query.hostelId,
    hostelIds,
    leaveTypeId: query.leaveTypeId,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    page: query.page,
    limit: query.limit,
  });
}
