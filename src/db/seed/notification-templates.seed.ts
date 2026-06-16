import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { notificationTemplates } from "@/db";
import { db } from "@/lib/db";

const TEMPLATES = [
  // EMAIL templates
  {
    eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "Leave Request Submitted",
    templateBody:
      "Your leave request {{leaveId}} has been submitted and is pending approval.",
  },
  {
    eventKey: "LEAVE_APPROVED",
    channel: "EMAIL" as const,
    subject: "Leave Request Approved",
    templateBody:
      "Your leave request {{leaveId}} has been approved. You may now generate your QR pass.",
  },
  {
    eventKey: "LEAVE_REJECTED",
    channel: "EMAIL" as const,
    subject: "Leave Request Rejected",
    templateBody:
      "Your leave request {{leaveId}} has been rejected. Reason: {{reason}}",
  },
  {
    eventKey: "LEAVE_CANCELLED",
    channel: "EMAIL" as const,
    subject: "Leave Request Cancelled",
    templateBody:
      "Your leave request {{leaveId}} has been cancelled.",
  },
  {
    eventKey: "LEAVE_EXTENSION_REQUESTED",
    channel: "EMAIL" as const,
    subject: "Leave Extension Requested",
    templateBody:
      "Extension #{{extensionNumber}} for leave {{leaveId}} has been requested.",
  },
  {
    eventKey: "LEAVE_EXTENSION_APPROVED",
    channel: "EMAIL" as const,
    subject: "Leave Extension Approved",
    templateBody:
      "Extension #{{extensionNumber}} for leave {{leaveId}} has been approved.",
  },
  {
    eventKey: "LEAVE_EXTENSION_REJECTED",
    channel: "EMAIL" as const,
    subject: "Leave Extension Rejected",
    templateBody:
      "Extension #{{extensionNumber}} for leave {{leaveId}} has been rejected.",
  },
  {
    eventKey: "LEAVE_COMPLETED",
    channel: "EMAIL" as const,
    subject: "Leave Completed",
    templateBody:
      "Your leave request {{leaveId}} has been marked as completed.",
  },
  {
    eventKey: "LEAVE_EXPIRED",
    channel: "EMAIL" as const,
    subject: "Leave Expired",
    templateBody:
      "Your leave request {{leaveId}} has expired.",
  },
  {
    eventKey: "LEAVE_OVERDUE",
    channel: "EMAIL" as const,
    subject: "Leave Overdue",
    templateBody:
      "Your leave request {{leaveId}} has expired. Please contact your warden.",
  },

  // SMS templates (parent-only)
  {
    eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    channel: NOTIFICATION_CHANNEL.SMS,
    subject: null,
    templateBody:
      "{{studentName}} applied for a leave. Approve: {{approvalLink}} or reply 1 {{code}} to approve, 2 {{code}} to reject.",
  },
  {
    eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "Leave approval needed for {{studentName}}",
    templateBody:
      "{{studentName}} has requested leave from {{dates}}. Reason: {{reason}}. Click to review and respond: {{approvalLink}}",
  },
  {
    eventKey: NOTIFICATION_EVENT.QR_GENERATED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "QR pass generated",
    templateBody: "Your QR pass for leave {{leaveId}} is ready.",
  },
  {
    eventKey: NOTIFICATION_EVENT.QR_INVALIDATED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "QR pass invalidated",
    templateBody: "Your QR pass for leave {{leaveId}} is no longer valid.",
  },
];

export async function seedNotificationTemplates() {
  let count = 0;

  for (const template of TEMPLATES) {
      const code = `${template.eventKey.toLowerCase()}_${template.channel.toLowerCase()}`;
      await db.insert(notificationTemplates).values({
        code,
        eventKey: template.eventKey,
        channel: template.channel,
        subject: template.subject,
        templateBody: template.templateBody,
        isActive: true,
      }).onConflictDoUpdate({
        target: [notificationTemplates.eventKey, notificationTemplates.channel],
        set: { subject: template.subject, templateBody: template.templateBody, isActive: true, updatedAt: new Date() },
      });
      count++;
  }

  console.log(`Seeded ${count} notification templates`);
}

export default seedNotificationTemplates;
