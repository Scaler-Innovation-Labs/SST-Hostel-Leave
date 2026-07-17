import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { type LeaveExtension,leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listLeaveExtensions(
  leaveRequestId: string,
  query: { page: number; limit: number },
  currentUser: CurrentUser
): Promise<{ items: LeaveExtension[]; total: number; page: number; limit: number; totalPages: number }> {
  const leave = await leaveRepository.findById(leaveRequestId);
  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  await verifyStudentOwnership(currentUser, leave.studentId);

  return leaveExtensionRepository.findByLeaveRequestIdPaginated(leaveRequestId, query.page, query.limit);
}

