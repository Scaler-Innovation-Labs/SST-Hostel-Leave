import type { MovementEvent } from "@/constants/movement/movement-event";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";

export async function listMovements(query: ListMovementsQuery) {
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

