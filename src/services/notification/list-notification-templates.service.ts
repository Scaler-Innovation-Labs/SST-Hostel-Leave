import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import { NotFoundError } from "@/lib/errors";

export async function listNotificationTemplates() {
  return notificationTemplateRepository.list();
}

export async function getNotificationTemplateById(id: string) {
  const template = await notificationTemplateRepository.findById(id);
  if (!template) throw new NotFoundError("NotificationTemplate");
  return template;
}
