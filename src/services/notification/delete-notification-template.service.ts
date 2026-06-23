import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import { NotFoundError } from "@/lib/errors";

export async function deleteNotificationTemplate(id: string) {
  const existing = await notificationTemplateRepository.findById(id);
  if (!existing) throw new NotFoundError("NotificationTemplate");

  await notificationTemplateRepository.delete(id);

  return { deleted: true };
}
