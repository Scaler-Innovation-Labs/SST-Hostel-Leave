import { notificationLogRepository, type PaginatedLogs } from "@/db/repositories/notification/notification-log.repository";
import type { ListNotificationLogsQuery } from "@/dto/notification/list-notification-logs.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds } from "@/services/shared/authorization.service";

export async function listNotificationLogs(
  query: ListNotificationLogsQuery,
  currentUser: CurrentUser
): Promise<PaginatedLogs> {
  // Staff visibility: role-scoped assignments (e.g. ADMIN over Hostel A)
  // restrict the delivery logs they can see to their hostels. No scopes =
  // unrestricted (ALL). SUPER_ADMIN always sees everything.
  const scopedHostelIds = getScopedHostelIds(currentUser);

  return notificationLogRepository.findByFilters({
    eventType: query.eventType,
    channel: query.channel,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    hostelIds: scopedHostelIds.length > 0 ? scopedHostelIds : undefined,
    page: query.page,
    limit: query.limit,
  });
}
