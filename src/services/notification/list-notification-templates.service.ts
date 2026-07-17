import { type NotificationTemplate,notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import { NotFoundError } from "@/lib/errors";

export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  return notificationTemplateRepository.list();
}

export async function getNotificationTemplateById(id: string): Promise<NotificationTemplate> {
  const template = await notificationTemplateRepository.findById(id);
  if (!template) throw new NotFoundError("NotificationTemplate");
  return template;
}
