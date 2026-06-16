import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { NOTIFICATION_RECIPIENT_TYPE } from "@/constants/notification/notification-recipient-type";
import {
  notificationRuleChannels,
  notificationRuleRecipients,
  notificationRules,
  notificationTemplates,
} from "@/db";
import { db } from "@/lib/db";
import { count, isNull } from "drizzle-orm";

type RuleDraft = {
  eventType: (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT];
  templateCode: string;
  recipientTypes: Array<(typeof NOTIFICATION_RECIPIENT_TYPE)[keyof typeof NOTIFICATION_RECIPIENT_TYPE]>;
  channels: Array<(typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]>;
  enabled: boolean;
  customRecipients: Array<{ type: string; value: string }> | null;
};

const GLOBAL_RULES: RuleDraft[] = [
  {
    eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
    templateCode: "leave_submitted_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.CURRENT_APPROVER],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
    templateCode: "leave_approved_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_REJECTED,
    templateCode: "leave_rejected_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_CANCELLED,
    templateCode: "leave_cancelled_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_EXTENSION_REQUESTED,
    templateCode: "leave_extension_requested_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.CURRENT_APPROVER],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_EXTENSION_APPROVED,
    templateCode: "leave_extension_approved_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_EXTENSION_REJECTED,
    templateCode: "leave_extension_rejected_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_COMPLETED,
    templateCode: "leave_completed_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_EXPIRED,
    templateCode: "leave_expired_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.WARDEN],
    channels: [NOTIFICATION_CHANNEL.EMAIL],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_OVERDUE,
    templateCode: "leave_overdue_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.WARDEN, NOTIFICATION_RECIPIENT_TYPE.POC],
    channels: [NOTIFICATION_CHANNEL.EMAIL],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    templateCode: "parent_approval_requested_sms",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
    channels: [NOTIFICATION_CHANNEL.SMS],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    templateCode: "parent_approval_requested_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
    channels: [NOTIFICATION_CHANNEL.EMAIL],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.QR_GENERATED,
    templateCode: "qr_generated_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.QR_INVALIDATED,
    templateCode: "qr_invalidated_email",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
    channels: [NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.PUSH],
    enabled: true,
    customRecipients: null,
  },

  // ── SLACK NOTIFICATIONS (Staff) ──
  {
    eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
    templateCode: "leave_submitted_slack",
    recipientTypes: [
      NOTIFICATION_RECIPIENT_TYPE.POC,
      NOTIFICATION_RECIPIENT_TYPE.WARDEN,
      NOTIFICATION_RECIPIENT_TYPE.ADMIN,
    ],
    channels: [NOTIFICATION_CHANNEL.SLACK],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
    templateCode: "leave_approved_slack",
    recipientTypes: [
      NOTIFICATION_RECIPIENT_TYPE.POC,
      NOTIFICATION_RECIPIENT_TYPE.WARDEN,
    ],
    channels: [NOTIFICATION_CHANNEL.SLACK],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_REJECTED,
    templateCode: "leave_rejected_slack",
    recipientTypes: [
      NOTIFICATION_RECIPIENT_TYPE.POC,
      NOTIFICATION_RECIPIENT_TYPE.WARDEN,
    ],
    channels: [NOTIFICATION_CHANNEL.SLACK],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_EXPIRED,
    templateCode: "leave_expired_slack",
    recipientTypes: [
      NOTIFICATION_RECIPIENT_TYPE.POC,
      NOTIFICATION_RECIPIENT_TYPE.WARDEN,
      NOTIFICATION_RECIPIENT_TYPE.ADMIN,
    ],
    channels: [NOTIFICATION_CHANNEL.SLACK],
    enabled: true,
    customRecipients: null,
  },
  {
    eventType: NOTIFICATION_EVENT.LEAVE_OVERDUE,
    templateCode: "leave_overdue_slack",
    recipientTypes: [
      NOTIFICATION_RECIPIENT_TYPE.POC,
      NOTIFICATION_RECIPIENT_TYPE.WARDEN,
      NOTIFICATION_RECIPIENT_TYPE.ADMIN,
    ],
    channels: [NOTIFICATION_CHANNEL.SLACK],
    enabled: true,
    customRecipients: null,
  },
];

export async function seedNotificationRules() {
  const [row] = await db
    .select({ count: count() })
    .from(notificationRules)
    .where(isNull(notificationRules.leaveTypeId));

  if (row?.count && row.count > 0) {
    console.log("Global notification rules already exist \u2014 skipping");
    return;
  }

  const templates = await db.select().from(notificationTemplates);

  const templateByCode = new Map(templates.map((t) => [t.code, t.id]));

  let inserted = 0;

  for (const rule of GLOBAL_RULES) {
    const templateId = templateByCode.get(rule.templateCode);
    if (!templateId) {
      console.warn(`Template code "${rule.templateCode}" not found \u2014 skipping rule`);
      continue;
    }

    const [created] = await db
      .insert(notificationRules)
      .values({
        leaveTypeId: null,
        eventType: rule.eventType,
        templateId,
        enabled: rule.enabled,
        customRecipients: rule.customRecipients,
      })
      .returning();

    if (!created) continue;

    const ruleId = created.id;

    if (rule.recipientTypes.length > 0) {
      await db.insert(notificationRuleRecipients).values(
        rule.recipientTypes.map((r) => ({
          ruleId,
          recipientType: r,
        })),
      );
    }

    if (rule.channels.length > 0) {
      await db.insert(notificationRuleChannels).values(
        rule.channels.map((c) => ({
          ruleId,
          channel: c,
        })),
      );
    }

    inserted++;
  }

  console.log(`Seeded ${inserted} global notification rules`);
}

export default seedNotificationRules;
