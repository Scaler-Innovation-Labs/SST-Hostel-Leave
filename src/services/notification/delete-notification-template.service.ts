import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteNotificationTemplate(id: string, actorUserId: string | null = null): Promise<{ deleted: boolean }> {
  const existing = await notificationTemplateRepository.findById(id);
  if (!existing) throw new NotFoundError("NotificationTemplate");

  await notificationTemplateRepository.delete(id);

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_TEMPLATE,
      id,
      actorUserId,
      { code: existing.code },
    );
  }

  return { deleted: true };
}
