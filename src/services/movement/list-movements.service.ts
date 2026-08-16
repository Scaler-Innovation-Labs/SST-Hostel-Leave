import type { MovementEvent } from "@/constants/movement/movement-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { movementEventRepository, type MovementEventRow } from "@/db/repositories/movement/movement-event.repository";
import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted, verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listMovements(
  query: ListMovementsQuery,
  currentUser: CurrentUser
): Promise<{
  items: Array<MovementEventRow & { studentName: string | null; studentRollNumber: string | null; fromStateName: string | null; toStateName: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  // Ownership check: a STUDENT may only see their own movements. The
  // studentId filter is the direct attack surface — without a leaveRequestId
  // a student could pass any studentId and read another student's history.
  // Staff are scoped separately below via hostelIds.
  if (query.studentId) {
    await verifyStudentOwnership(currentUser, query.studentId);
  }

  if (query.leaveRequestId) {
    const leave = await leaveRepository.findById(query.leaveRequestId);
    if (leave) {
      await verifyStudentOwnership(currentUser, leave.studentId);
    }
  }

  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  return movementEventRepository.findByFilters({
    studentId: query.studentId,
    eventType: query.eventType as MovementEvent | undefined,
    leaveRequestId: query.leaveRequestId,
    search: query.search,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    hostelIds,
    page: query.page,
    limit: query.limit,
  });
}

