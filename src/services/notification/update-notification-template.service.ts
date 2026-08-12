import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type NotificationTemplate,notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import type { SaveNotificationTemplateDto } from "@/dto/notification/save-notification-template.dto";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateNotificationTemplate(
  id: string,
  dto: Partial<SaveNotificationTemplateDto>,
  actorUserId: string | null = null
): Promise<NotificationTemplate | null> {
  const existing = await notificationTemplateRepository.findById(id);
  if (!existing) throw new NotFoundError("NotificationTemplate");

  const template = await notificationTemplateRepository.update(id, {
    code: dto.code ?? existing.code,
    eventKey: dto.eventKey ?? existing.eventKey,
    channel: dto.channel ?? existing.channel,
    subject: dto.subject !== undefined ? dto.subject : existing.subject,
    templateBody: dto.templateBody ?? existing.templateBody,
    isActive: dto.isActive ?? existing.isActive,
    metadata: dto.metadata !== undefined ? dto.metadata : existing.metadata,
  });

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_TEMPLATE,
      id,
      actorUserId,
      { code: dto.code ?? existing.code },
    );
  }

  return template;
}
