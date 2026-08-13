import { inArray, isNotNull } from "drizzle-orm";

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

// Staff alerts fire when the relevant workflow step becomes current, never on
// submission:
//   - POC review  → LEAVE_POC_REVIEW_REQUIRED (POC step current, i.e. the
//     parent already approved when a parent step exists)
//   - Admin review → LEAVE_APPROVAL_REQUIRED (ADMIN step current, i.e. after
//     POC or parent approval)
// Leave types whose FIRST step is the POC step (no parent step) keep their
// POC alert on LEAVE_SUBMITTED so the POC is notified immediately.
const LEAVE_TYPE_RULES: LeaveTypeRuleDraft[] = [
  {
    leaveTypeCode: "RE_EXAM",
    rules: [
      {
        // Parent approved → ADMIN step current.
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_re_exam",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_re_exam",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        // Parent approved → ADMIN step current.
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_long_leave",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_long_leave",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        // Parent approved → ADMIN step current.
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_late_entry",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_late_entry",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        // No parent step — the POC step is first, so the POC is alerted on
        // submission and acts immediately.
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
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        enabled: true,
        customRecipients: null,
      },
      {
        // POC approved → the ADMIN step is now current: alert the hostel's
        // admin(s) via Slack using the "awaiting your review" template.
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_late_stay_admin",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
    ],
  },
  {
    leaveTypeCode: "DIFFERENT_HOSTEL",
    rules: [
      {
        // Parent approved → ADMIN step current.
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_diff_hostel",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_diff_hostel",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_holiday",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        // Parent approved → POC step current: alert the POC now (not on
        // submission, which happens before the parent has reviewed).
        eventType: NOTIFICATION_EVENT.LEAVE_POC_REVIEW_REQUIRED,
        templateCode: "leave_submitted_slack_internship_poc",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.POC],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        // POC approved → ADMIN step current: alert the hostel's admin(s).
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_internship_admin",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_internship",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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
        // Parent approved → POC step current: alert the POC now.
        eventType: NOTIFICATION_EVENT.LEAVE_POC_REVIEW_REQUIRED,
        templateCode: "leave_submitted_slack_marriage_poc",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.POC],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        // POC approved → ADMIN step current: alert the hostel's admin(s).
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVAL_REQUIRED,
        templateCode: "leave_submitted_slack_marriage",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN],
        channels: [NOTIFICATION_CHANNEL.SLACK],
        enabled: true,
        customRecipients: null,
      },
      {
        eventType: NOTIFICATION_EVENT.LEAVE_APPROVED,
        templateCode: "leave_approved_email_marriage",
        recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT, NOTIFICATION_RECIPIENT_TYPE.PARENT],
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

// Global rules apply to every leave type (leave_type_id = NULL). OVERDUE
// alerts email the student only, asking them to extend the leave.
const GLOBAL_RULES: RuleDraft[] = [
  {
    eventType: NOTIFICATION_EVENT.LEAVE_OVERDUE,
    templateCode: "leave_overdue_email_student",
    recipientTypes: [NOTIFICATION_RECIPIENT_TYPE.STUDENT],
    channels: [NOTIFICATION_CHANNEL.EMAIL],
    enabled: true,
    customRecipients: null,
  },
];

export async function seedNotificationRules() {
  const existingRules = await db
    .select()
    .from(notificationRules)
    .where(isNotNull(notificationRules.leaveTypeId));

  // Wipe existing rules to allow re-seeding after template changes
  if (existingRules.length > 0) {
    const existingIds = existingRules.map((r) => r.id);
    await db.delete(notificationRuleChannels).where(inArray(notificationRuleChannels.ruleId, existingIds));
    await db.delete(notificationRuleRecipients).where(inArray(notificationRuleRecipients.ruleId, existingIds));
    await db.delete(notificationRules).where(inArray(notificationRules.id, existingIds));
    logger.info("Re-seeding notification rules", { removed: existingRules.length });
  }

  const templates = await db.select().from(notificationTemplates);
  const templatesByCode = new Map(templates.map((t) => [t.code, t.id]));

  const leaveTypes = await db
    .select({ id: leaveTypesTable.id, code: leaveTypesTable.code })
    .from(leaveTypesTable);

  const leaveTypeByCode = new Map(leaveTypes.map((lt) => [lt.code, lt.id]));

  let inserted = 0;

  const insertRule = async (rule: RuleDraft, leaveTypeId: string | null) => {
    const templateId = templatesByCode.get(rule.templateCode);
    if (!templateId) {
      logger.warn("Template code not found", { templateCode: rule.templateCode });
      return;
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

    if (!created) return;

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
  };

  for (const rule of GLOBAL_RULES) {
    await insertRule(rule, null);
  }

  for (const group of LEAVE_TYPE_RULES) {
    const leaveTypeId = leaveTypeByCode.get(group.leaveTypeCode);
    if (!leaveTypeId) {
      logger.warn("Leave type code not found in DB", { leaveTypeCode: group.leaveTypeCode });
      continue;
    }

    for (const rule of group.rules) {
      await insertRule(rule, leaveTypeId);
    }
  }

  logger.info("Seeded notification rules", { count: inserted });
}

export default seedNotificationRules;
