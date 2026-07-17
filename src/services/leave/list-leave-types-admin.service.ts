import { type LeaveType,leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";

export async function listLeaveTypesAdmin(): Promise<LeaveType[]> {
  return leaveTypeRepository.findAllIncludingInactive();
}
