import { eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import type { SaveNotificationRuleDto } from "@/dto/notification/save-notification-rule.dto";

import {
  notificationRuleChannels,
  notificationRuleRecipients,
  notificationRules,
} from "@/db/schema/notification-rules";
import { notificationTemplates } from "@/db/schema/notification";

type RuleWriteDb = Pick<typeof db, "select" | "insert" | "update" | "delete">;

type RuleRow = {
  id: string;
  leaveTypeId: string | null;
  eventType: string;
  templateId: string;
  enabled: boolean;
  customRecipients: unknown;
  createdAt: Date;
  updatedAt: Date;
  templateCode: string;
  recipients: Array<{ recipientType: string }>;
  channels: Array<{ channel: string }>;
};

async function attachChildren(
  rows: Array<{
    id: string;
    leaveTypeId: string | null;
    eventType: string;
    templateId: string;
    enabled: boolean;
    customRecipients: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>,
  dbClient: RuleWriteDb
): Promise<RuleRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const [recipients, channels] = await Promise.all([
        dbClient
          .select()
          .from(notificationRuleRecipients)
          .where(eq(notificationRuleRecipients.ruleId, row.id)),
        dbClient
          .select()
          .from(notificationRuleChannels)
          .where(eq(notificationRuleChannels.ruleId, row.id)),
      ]);

      return {
        ...row,
        templateCode: "",
        recipients,
        channels,
      } satisfies RuleRow;
    })
  );
}

export const notificationRuleRepository = {
  async findGlobal(
    dbClient: RuleWriteDb = db
  ): Promise<RuleRow[]> {
    const rows = await dbClient
      .select()
      .from(notificationRules)
      .leftJoin(
        notificationTemplates,
        eq(notificationRules.templateId, notificationTemplates.id)
      )
      .where(isNull(notificationRules.leaveTypeId))
      .orderBy(notificationRules.eventType);

    return attachChildren(
      rows.map((r) => ({
        id: r.notification_rules.id,
        leaveTypeId: r.notification_rules.leaveTypeId,
        eventType: r.notification_rules.eventType,
        templateId: r.notification_rules.templateId,
        enabled: r.notification_rules.enabled,
        customRecipients: r.notification_rules.customRecipients,
        createdAt: r.notification_rules.createdAt,
        updatedAt: r.notification_rules.updatedAt,
      })),
      dbClient
    );
  },

  async findByLeaveType(
    leaveTypeId: string,
    dbClient: RuleWriteDb = db
  ): Promise<RuleRow[]> {
    const rows = await dbClient
      .select()
      .from(notificationRules)
      .leftJoin(
        notificationTemplates,
        eq(notificationRules.templateId, notificationTemplates.id)
      )
      .where(eq(notificationRules.leaveTypeId, leaveTypeId))
      .orderBy(notificationRules.eventType);

    return attachChildren(
      rows.map((r) => ({
        id: r.notification_rules.id,
        leaveTypeId: r.notification_rules.leaveTypeId,
        eventType: r.notification_rules.eventType,
        templateId: r.notification_rules.templateId,
        enabled: r.notification_rules.enabled,
        customRecipients: r.notification_rules.customRecipients,
        createdAt: r.notification_rules.createdAt,
        updatedAt: r.notification_rules.updatedAt,
      })),
      dbClient
    );
  },

  async findById(
    id: string,
    dbClient: RuleWriteDb = db
  ): Promise<RuleRow | null> {
    const rows = await dbClient
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.id, id))
      .limit(1);

    if (!rows[0]) return null;

    const result = await attachChildren(
      [
        {
          id: rows[0].id,
          leaveTypeId: rows[0].leaveTypeId,
          eventType: rows[0].eventType,
          templateId: rows[0].templateId,
          enabled: rows[0].enabled,
          customRecipients: rows[0].customRecipients,
          createdAt: rows[0].createdAt,
          updatedAt: rows[0].updatedAt,
        },
      ],
      dbClient
    );

    return result[0] ?? null;
  },

  async create(
    input: SaveNotificationRuleDto & { leaveTypeId?: string | null },
    dbClient: RuleWriteDb = db
  ): Promise<string> {
    const [rule] = await dbClient
      .insert(notificationRules)
      .values({
        leaveTypeId: input.leaveTypeId ?? null,
        eventType: input.eventType as never,
        templateId: input.templateId,
        enabled: input.enabled,
        customRecipients: (input.customRecipients ?? []) as never,
      })
      .returning();

    const ruleId = rule!.id;

    if (input.recipientTypes.length > 0) {
      await dbClient.insert(notificationRuleRecipients).values(
        input.recipientTypes.map((rt) => ({
          ruleId,
          recipientType: rt as never,
        }))
      );
    }

    if (input.channels.length > 0) {
      await dbClient.insert(notificationRuleChannels).values(
        input.channels.map((ch) => ({
          ruleId,
          channel: ch as never,
        }))
      );
    }

    return ruleId;
  },

  async update(
    id: string,
    input: SaveNotificationRuleDto & { leaveTypeId?: string | null },
    dbClient: RuleWriteDb = db
  ): Promise<void> {
    await dbClient
      .update(notificationRules)
      .set({
        eventType: input.eventType as never,
        templateId: input.templateId,
        enabled: input.enabled,
        customRecipients: (input.customRecipients ?? []) as never,
        updatedAt: new Date(),
      })
      .where(eq(notificationRules.id, id));

    await dbClient
      .delete(notificationRuleRecipients)
      .where(eq(notificationRuleRecipients.ruleId, id));

    await dbClient
      .delete(notificationRuleChannels)
      .where(eq(notificationRuleChannels.ruleId, id));

    if (input.recipientTypes.length > 0) {
      await dbClient.insert(notificationRuleRecipients).values(
        input.recipientTypes.map((rt) => ({
          ruleId: id,
          recipientType: rt as never,
        }))
      );
    }

    if (input.channels.length > 0) {
      await dbClient.insert(notificationRuleChannels).values(
        input.channels.map((ch) => ({
          ruleId: id,
          channel: ch as never,
        }))
      );
    }
  },

  async delete(
    id: string,
    dbClient: RuleWriteDb = db
  ): Promise<void> {
    await dbClient
      .delete(notificationRules)
      .where(eq(notificationRules.id, id));
  },

  async findActiveByEvent(
    eventType: string,
    leaveTypeId?: string | null,
    dbClient: RuleWriteDb = db
  ): Promise<RuleRow[]> {
    if (leaveTypeId) {
      const rows = await dbClient
        .select()
        .from(notificationRules)
        .leftJoin(
          notificationTemplates,
          eq(notificationRules.templateId, notificationTemplates.id)
        )
        .where(
          eq(notificationRules.eventType, eventType as never)
        )
        .$dynamic();

      const filtered = rows.filter((r) => {
        const ltId = r.notification_rules.leaveTypeId;
        return ltId === leaveTypeId || ltId === null;
      });

      const mapped = filtered.map((r) => ({
        id: r.notification_rules.id,
        leaveTypeId: r.notification_rules.leaveTypeId,
        eventType: r.notification_rules.eventType,
        templateId: r.notification_rules.templateId,
        enabled: r.notification_rules.enabled,
        customRecipients: r.notification_rules.customRecipients,
        createdAt: r.notification_rules.createdAt,
        updatedAt: r.notification_rules.updatedAt,
      }));

      const enabled = mapped.filter((r) => r.enabled);

      if (enabled.length === 0) return [];

      const perLeaveType = enabled.filter((r) => r.leaveTypeId === leaveTypeId);
      if (perLeaveType.length > 0) {
        return attachChildren(perLeaveType, dbClient);
      }

      const global = enabled.filter((r) => r.leaveTypeId === null);
      return attachChildren(global, dbClient);
    }

    const rows = await dbClient
      .select()
      .from(notificationRules)
      .leftJoin(
        notificationTemplates,
        eq(notificationRules.templateId, notificationTemplates.id)
      )
      .where(
        eq(notificationRules.eventType, eventType as never)
      );

    const mapped = rows.map((r) => ({
      id: r.notification_rules.id,
      leaveTypeId: r.notification_rules.leaveTypeId,
      eventType: r.notification_rules.eventType,
      templateId: r.notification_rules.templateId,
      enabled: r.notification_rules.enabled,
      customRecipients: r.notification_rules.customRecipients,
      createdAt: r.notification_rules.createdAt,
      updatedAt: r.notification_rules.updatedAt,
    }));

    const enabled = mapped.filter((r) => r.enabled && r.leaveTypeId === null);

    return attachChildren(enabled, dbClient);
  },

  async deleteByLeaveType(
    leaveTypeId: string,
    dbClient: RuleWriteDb = db
  ): Promise<void> {
    await dbClient
      .delete(notificationRules)
      .where(eq(notificationRules.leaveTypeId, leaveTypeId));
  },
};

export default notificationRuleRepository;
