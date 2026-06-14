import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";

export async function listLeaveTypes() {
  return leaveTypeRepository.findAll();
}

