import { notificationLogRepository, type PaginatedNotifications } from "@/db/repositories/notification/notification-log.repository";

export async function listNotifications(userId: string, page: number, limit: number): Promise<PaginatedNotifications> {
  return notificationLogRepository.findByUserIdPaginated(userId, page, limit);
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  await notificationLogRepository.markAsRead(ids);
}
