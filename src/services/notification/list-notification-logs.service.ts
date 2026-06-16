import { notificationLogRepository } from "@/db/repositories/notification/notification-log.repository";
import type { ListNotificationLogsQuery } from "@/dto/notification/list-notification-logs.dto";

export async function listNotificationLogs(query: ListNotificationLogsQuery) {
  return notificationLogRepository.findByFilters({
    eventType: query.eventType,
    channel: query.channel,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page: query.page,
    limit: query.limit,
  });
}
