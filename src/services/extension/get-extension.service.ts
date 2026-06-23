import type { CurrentUser } from "@/lib/auth/types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { NotFoundError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function getExtension(id: string, currentUser: CurrentUser) {
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

