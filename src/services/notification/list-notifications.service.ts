import { notificationLogRepository } from "@/db/repositories/notification/notification-log.repository";

export async function listNotifications(userId: string, page: number, limit: number) {
  return notificationLogRepository.findByUserIdPaginated(userId, page, limit);
}

export async function markNotificationsRead(ids: string[]) {
  await notificationLogRepository.markAsRead(ids);
}
