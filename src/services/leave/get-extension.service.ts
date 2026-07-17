import { leaveRepository, type LeaveRequest } from "@/db/repositories/leave/leave.repository";
import { type LeaveExtension,leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function getExtension(id: string, currentUser: CurrentUser): Promise<LeaveExtension & { leave: LeaveRequest | null }> {
  const extension = await leaveExtensionRepository.findById(id);

  if (!extension) {
    throw new NotFoundError("LeaveExtension");
  }

  const leave = await leaveRepository.findById(extension.leaveRequestId);

  if (leave) {
    await verifyStudentOwnership(currentUser, leave.studentId);
  }

  return {
    ...extension,
    leave,
  };
}

