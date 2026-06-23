import type { MovementEvent } from "@/constants/movement/movement-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listMovements(query: ListMovementsQuery, currentUser: CurrentUser) {
  if (query.leaveRequestId) {
    const leave = await leaveRepository.findById(query.leaveRequestId);
    if (leave) {
      await verifyStudentOwnership(currentUser, leave.studentId);
    }
  }

  return movementEventRepository.findByFilters({
    studentId: query.studentId,
    eventType: query.eventType as MovementEvent | undefined,
    leaveRequestId: query.leaveRequestId,
    search: query.search,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    page: query.page,
    limit: query.limit,
  });
}

