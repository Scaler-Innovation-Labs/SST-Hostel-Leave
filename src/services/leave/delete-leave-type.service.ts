import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { NotFoundError } from "@/lib/errors";

export async function deleteLeaveType(id: string) {
  const existing = await leaveTypeRepository.findById(id);
  if (!existing) {
    throw new NotFoundError("LeaveType");
  }

  await leaveTypeRepository.softDelete(id);
}
