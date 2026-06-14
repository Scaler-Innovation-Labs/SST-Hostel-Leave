import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { NotFoundError } from "@/lib/errors";

export async function getExtension(id: string) {
  const extension = await leaveExtensionRepository.findById(id);

  if (!extension) {
    throw new NotFoundError("LeaveExtension");
  }

  const leave = await leaveRepository.findById(extension.leaveRequestId);

  return {
    ...extension,
    leave,
  };
}

