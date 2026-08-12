import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { notificationRuleRepository } from "@/db/repositories/notification/notification-rule.repository";
import type { SaveNotificationRuleDto } from "@/dto/notification/save-notification-rule.dto";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export type NotificationRuleResponse = {
  id: string;
  leaveTypeId: string | null;
  eventType: string;
  templateId: string;
  templateCode: string;
  enabled: boolean;
  recipientTypes: string[];
  channels: string[];
  customRecipients: Array<{ type: string; value: string }>;
  createdAt: Date;
  updatedAt: Date;
};

function toResponse(row: Awaited<ReturnType<typeof notificationRuleRepository.findGlobal>>[number]): NotificationRuleResponse {
  return {
    id: row.id,
    leaveTypeId: row.leaveTypeId,
    eventType: row.eventType,
    templateId: row.templateId,
    templateCode: row.templateCode,
    enabled: row.enabled,
    recipientTypes: row.recipients.map((r) => r.recipientType),
    channels: row.channels.map((c) => c.channel),
    customRecipients: (row.customRecipients ?? []) as Array<{ type: string; value: string }>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getGlobalRules(): Promise<NotificationRuleResponse[]> {
  const rows = await notificationRuleRepository.findGlobal();
  return rows.map(toResponse);
}

export async function getRulesByLeaveType(
  leaveTypeId: string
): Promise<NotificationRuleResponse[]> {
  const rows = await notificationRuleRepository.findByLeaveType(
    leaveTypeId
  );
  return rows.map(toResponse);
}

export async function getNotificationRuleById(id: string): Promise<NotificationRuleResponse> {
  const row = await notificationRuleRepository.findById(id);
  if (!row) throw new NotFoundError("NotificationRule");
  return toResponse(row);
}

export async function createNotificationRule(
  leaveTypeId: string | null,
  dto: SaveNotificationRuleDto,
  actorUserId: string | null = null
): Promise<NotificationRuleResponse> {
  const id = await notificationRuleRepository.create({
    ...dto,
    leaveTypeId,
  });
  const row = await notificationRuleRepository.findById(id);
  if (!row) throw new NotFoundError("NotificationRule");

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_RULE,
      id,
      actorUserId,
      { eventType: dto.eventType, leaveTypeId },
    );
  }

  return toResponse(row);
}

export async function updateNotificationRule(
  id: string,
  leaveTypeId: string | null,
  dto: SaveNotificationRuleDto,
  actorUserId: string | null = null
): Promise<NotificationRuleResponse> {
  await notificationRuleRepository.update(id, {
    ...dto,
    leaveTypeId,
  });
  const row = await notificationRuleRepository.findById(id);
  if (!row) throw new NotFoundError("NotificationRule");

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_RULE,
      id,
      actorUserId,
      { eventType: dto.eventType, leaveTypeId },
    );
  }

  return toResponse(row);
}

export async function deleteNotificationRule(
  id: string,
  actorUserId: string | null = null
): Promise<void> {
  await notificationRuleRepository.delete(id);

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.NOTIFICATION_RULE,
      id,
      actorUserId,
      {},
    );
  }
}
