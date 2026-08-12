import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type NotificationTemplate,notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import type { SaveNotificationTemplateDto } from "@/dto/notification/save-notification-template.dto";
import { auditService } from "@/services/audit/audit.service";

export async function saveNotificationTemplate(dto: SaveNotificationTemplateDto, actorUserId: string | null = null): Promise<NotificationTemplate> {
  const template = await notificationTemplateRepository.create({
    code: dto.code,
    eventKey: dto.eventKey,
    channel: dto.channel,
    subject: dto.subject ?? null,
    templateBody: dto.templateBody,
    isActive: dto.isActive,
    metadata: dto.metadata ?? null,
  });

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_TEMPLATE,
      template.id,
      actorUserId,
      { code: dto.code, eventKey: dto.eventKey, channel: dto.channel },
    );
  }

  return template;
}
