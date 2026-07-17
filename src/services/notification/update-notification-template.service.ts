import { type NotificationTemplate,notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import type { SaveNotificationTemplateDto } from "@/dto/notification/save-notification-template.dto";
import { NotFoundError } from "@/lib/errors";

export async function updateNotificationTemplate(
  id: string,
  dto: Partial<SaveNotificationTemplateDto>
): Promise<NotificationTemplate | null> {
  const existing = await notificationTemplateRepository.findById(id);
  if (!existing) throw new NotFoundError("NotificationTemplate");

  return notificationTemplateRepository.update(id, {
    code: dto.code ?? existing.code,
    eventKey: dto.eventKey ?? existing.eventKey,
    channel: dto.channel ?? existing.channel,
    subject: dto.subject !== undefined ? dto.subject : existing.subject,
    templateBody: dto.templateBody ?? existing.templateBody,
    isActive: dto.isActive ?? existing.isActive,
    metadata: dto.metadata !== undefined ? dto.metadata : existing.metadata,
  });
}
