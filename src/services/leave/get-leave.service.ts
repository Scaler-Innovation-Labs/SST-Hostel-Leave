import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { NotFoundError } from "@/lib/errors";

export async function getLeave(id: string) {
  const result = await leaveRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("LeaveRequest");
  }

  return result;
}

