import { count, isNotNull } from "drizzle-orm";

import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { NOTIFICATION_RECIPIENT_TYPE } from "@/constants/notification/notification-recipient-type";
import {
  leaveTypes as leaveTypesTable,
  notificationRuleChannels,
  notificationRuleRecipients,
  notificationRules,
  notificationTemplates,
} from "@/db";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type RuleDraft = {
  eventType: (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT];
  templateCode: string;
  recipientTypes: Array<(typeof NOTIFICATION_RECIPIENT_TYPE)[keyof typeof NOTIFICATION_RECIPIENT_TYPE]>;
  channels: Array<(typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]>;
  enabled: boolean;
  customRecipients: Array<{ type: string; value: string }> | null;
};

type LeaveTypeRuleDraft = {
  leaveTypeCode: string;
  rules: RuleDraft[];
};

const LEAVE_TYPE_RULES: LeaveTypeRuleDraft[] = [
  {
    leaveTypeCode: "RE_EXAM",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_re_exam",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_re_exam",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_re_exam",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "LONG_LEAVE",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_long_leave",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_long_leave",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_long_leave",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "LATE_ENTRY",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_late_entry",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_late_entry",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_late_entry",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "LATE_STAY_COLLEGE",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_late_stay_poc",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.POC],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_late_stay",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "DIFFERENT_HOSTEL",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_diff_hostel",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_diff_hostel",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_diff_hostel",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "HOLIDAY",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_holiday",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_holiday",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "INTERNSHIP",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_internship_poc",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.POC],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_internship",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_internship",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "MARRIAGE_BEREAVEMENT",
    rules: [
      {
        eventType: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
        templateCode: "leave_submitted_slack_marriage",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.WARDEN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_marriage",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        templateCode: "parent_approval_requested_sms_marriage",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.SMS],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
];

export async function seedNotificationRules() {
  const [row] = await db
    .select({ count: count() })
    .from(notificationRules)
    .where(isNotNull(notificationRules.leaveTypeId));

  if (row?.count && row.count > 0) {
    logger.info("Notification rules already exist — skipping");
    return;
  }

  const templates = await db.select().from(notificationTemplates);
  const templatesByCode = new Map(templates.map((t) => [t.code, t.id]));

  const leaveTypes = await db
    .select({ id: leaveTypesTable.id, code: leaveTypesTable.code })
    .from(leaveTypesTable);

  const leaveTypeByCode = new Map(leaveTypes.map((lt) => [lt.code, lt.id]));

  let inserted = 0;

  for (const group of LEAVE_TYPE_RULES) {
    const leaveTypeId = leaveTypeByCode.get(group.leaveTypeCode);
    if (!leaveTypeId) {
      logger.warn("Leave type code not found in DB", { leaveTypeCode: group.leaveTypeCode });
      continue;
    }

    for (const rule of group.rules) {
      const templateId = templatesByCode.get(rule.templateCode);
      if (!templateId) {
        logger.warn("Template code not found", { templateCode: rule.templateCode });
        continue;
      }

      const [created] = await db
        .insert(notificationRules)
        .values({
          leaveTypeId,
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
  }

  logger.info("Seeded notification rules", { count: inserted });
}

export default seedNotificationRules;
