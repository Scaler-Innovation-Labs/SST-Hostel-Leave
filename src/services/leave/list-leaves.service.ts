import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { leaveRepository, type LeaveWithRelations, type PaginatedResult } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/errors";

export async function listLeaves(query: ListLeavesQuery, currentUser?: { id: string; roles: string[] }): Promise<PaginatedResult<LeaveWithRelations>> {
  if (currentUser && currentUser.roles.includes(ROLES.STUDENT)) {
    const student = await studentRepository.findByUserId(currentUser.id);
    if (!student) {
      throw new AuthorizationError("Student profile not found");
    }
    query.studentId = student.id;
  }

  return leaveRepository.findByFilters({
    studentId: query.studentId,
    status: query.status as LeaveRequestStatus | undefined,
    leaveTypeId: query.leaveTypeId,
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

