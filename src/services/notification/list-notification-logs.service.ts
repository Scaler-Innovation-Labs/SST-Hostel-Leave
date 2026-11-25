import {
  type NotificationLog,
  notificationLogRepository,
  type PaginatedLogs,
} from "@/db/repositories/notification/notification-log.repository";

export type { NotificationLog };
import type { ListNotificationLogsQuery } from "@/dto/notification/list-notification-logs.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function listNotificationLogs(
  query: ListNotificationLogsQuery,
  currentUser: CurrentUser
): Promise<PaginatedLogs> {
  // Staff visibility: role-scoped assignments (e.g. ADMIN over Hostel A)
  // restrict the delivery logs they can see to their hostels. No scopes =
  // unrestricted (ALL). SUPER_ADMIN always sees everything.
  const restricted = isStaffScopeRestricted(currentUser);
  const scopedHostelIds = restricted ? getScopedHostelIds(currentUser) : [];

  if (restricted && scopedHostelIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: query.page,
      limit: query.limit,
      totalPages: 0,
    };
  }

  return notificationLogRepository.findByFilters({
    eventType: query.eventType,
    channel: query.channel,
    status: query.status,
    search: query.search,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    hostelIds: restricted ? scopedHostelIds : undefined,
    page: query.page,
    limit: query.limit,
  });
}
