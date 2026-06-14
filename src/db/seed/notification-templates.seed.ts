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

  // SMS templates
  {
    eventKey: "LEAVE_SUBMITTED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} submitted. Awaiting approval.",
  },
  {
    eventKey: "LEAVE_APPROVED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} approved. Generate QR from the portal.",
  },
  {
    eventKey: "LEAVE_REJECTED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} rejected.",
  },
  {
    eventKey: "LEAVE_CANCELLED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} cancelled.",
  },
  {
    eventKey: "LEAVE_EXTENSION_APPROVED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Extension for leave {{leaveId}} approved.",
  },
  {
    eventKey: "LEAVE_EXTENSION_REJECTED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Extension for leave {{leaveId}} rejected.",
  },
  {
    eventKey: "LEAVE_OVERDUE",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} overdue. Contact warden immediately.",
  },
  {
    eventKey: "LEAVE_COMPLETED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} marked as completed.",
  },
  {
    eventKey: "LEAVE_EXPIRED",
    channel: "SMS" as const,
    subject: null,
    templateBody:
      "Leave {{leaveId}} expired.",
  },
  {
    eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    channel: NOTIFICATION_CHANNEL.SMS,
    subject: null,
    templateBody:
      "Your ward {{studentName}} requests leave {{dates}}. Reason: {{reason}}. Approve: {{approvalLink}} OTP: {{otp}}",
  },
  {
    eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "Approval requested for {{studentName}}",
    templateBody: "{{studentName}} requests leave for {{dates}}. Reason: {{reason}}. Review: {{approvalLink}}",
  },
  {
    eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_REQUESTED,
    channel: NOTIFICATION_CHANNEL.SMS,
    subject: null,
    templateBody: "Extension #{{extensionNumber}} requested for leave {{leaveId}}.",
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
  {
    eventKey: NOTIFICATION_EVENT.QR_GENERATED,
    channel: NOTIFICATION_CHANNEL.SMS,
    subject: null,
    templateBody: "QR pass for leave {{leaveId}} is ready.",
  },
  {
    eventKey: NOTIFICATION_EVENT.QR_INVALIDATED,
    channel: NOTIFICATION_CHANNEL.SMS,
    subject: null,
    templateBody: "QR pass for leave {{leaveId}} has been invalidated.",
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
