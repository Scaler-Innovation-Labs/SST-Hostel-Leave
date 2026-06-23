import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";

export async function listLeaveTypesAdmin() {
  return leaveTypeRepository.findAllIncludingInactive();
}
