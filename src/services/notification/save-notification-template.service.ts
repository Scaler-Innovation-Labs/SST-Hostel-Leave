import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import type { SaveNotificationTemplateDto } from "@/dto/notification/save-notification-template.dto";

export async function saveNotificationTemplate(dto: SaveNotificationTemplateDto) {
  return notificationTemplateRepository.create({
    code: dto.code,
    eventKey: dto.eventKey,
    channel: dto.channel,
    subject: dto.subject ?? null,
    templateBody: dto.templateBody,
    isActive: dto.isActive,
    metadata: dto.metadata ?? null,
  });
}
