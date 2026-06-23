import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { NotFoundError } from "@/lib/errors";

export async function getLeaveTypeById(id: string) {
  const leaveType = await leaveTypeRepository.findById(id);
  if (!leaveType) {
    throw new NotFoundError("LeaveType");
  }
  return leaveType;
}
