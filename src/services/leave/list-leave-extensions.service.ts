import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { type LeaveApproval, leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { type LeaveExtension, leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export type LeaveExtensionWithApprovals = LeaveExtension & {
  approvals: LeaveApproval[];
};

export async function listLeaveExtensions(
  leaveRequestId: string,
  query: { page: number; limit: number },
  currentUser: CurrentUser
): Promise<{ items: LeaveExtensionWithApprovals[]; total: number; page: number; limit: number; totalPages: number }> {
  const leave = await leaveRepository.findById(leaveRequestId);
  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  // Scope-aware: students see only their own leaves; hostel-scoped
  // ADMIN/POC see only leaves in their hostels.
  await assertCanAccessLeave(currentUser, leave);

  const result = await leaveExtensionRepository.findByLeaveRequestIdPaginated(leaveRequestId, query.page, query.limit);

  const items = await Promise.all(
    result.items.map(async (ext) => {
      const approvals = await leaveApprovalRepository.findByLeaveExtensionId(ext.id);
      return {
        ...ext,
        approvals,
      };
    })
  );

  return {
    ...result,
    items,
  };
}

