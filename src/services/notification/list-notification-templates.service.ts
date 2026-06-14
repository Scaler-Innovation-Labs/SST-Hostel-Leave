import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";

export async function listNotificationTemplates() {
  return notificationTemplateRepository.list();
}
