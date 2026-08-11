import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { type LeaveApproval,leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ListExtensionApprovalsQuery } from "@/dto/extension/list-extension-approvals.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function listExtensionApprovals(
  query: ListExtensionApprovalsQuery,
  currentUser: CurrentUser
): Promise<{
  items: Array<LeaveApproval & { approverRoleCode: string | null; extension: { id: string; extensionNumber: number; reason: string; status: string; requestedEndAt: Date; currentEndAt: Date } | null; leaveRequest: { id: string; status: string; requestNumber: string } | null; studentName: string | null; studentRollNumber: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  return leaveApprovalRepository.findExtensionApprovals({
    status: query.status as LeaveApprovalDecision | undefined,
    search: query.search,
    hostelIds,
    page: query.page,
    limit: query.limit,
  });
}

