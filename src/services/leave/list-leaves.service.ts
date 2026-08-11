import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { leaveRepository, type LeaveWithRelations, type PaginatedResult } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/errors";
import { getScopedHostelIds } from "@/services/shared/authorization.service";

export async function listLeaves(query: ListLeavesQuery, currentUser?: CurrentUser): Promise<PaginatedResult<LeaveWithRelations>> {
  let hostelIds: string[] | undefined;

  if (currentUser && currentUser.roles.includes(ROLES.STUDENT)) {
    const student = await studentRepository.findByUserId(currentUser.id);
    if (!student) {
      throw new AuthorizationError("Student profile not found");
    }
    query.studentId = student.id;
  } else if (currentUser) {
    // Staff visibility: role-scoped assignments (e.g. ADMIN over Hostel A)
    // restrict the leaves they can see. No scopes = unrestricted (ALL).
    const scopedHostelIds = getScopedHostelIds(currentUser);
    if (scopedHostelIds.length > 0) {
      hostelIds = scopedHostelIds;
    }
  }

  return leaveRepository.findByFilters({
    studentId: query.studentId,
    status: query.status as LeaveRequestStatus | undefined,
    leaveTypeId: query.leaveTypeId,
    hostelId: query.hostelId,
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
    search: query.search,
    hostelIds,
    page: query.page,
    limit: query.limit,
  });
}

