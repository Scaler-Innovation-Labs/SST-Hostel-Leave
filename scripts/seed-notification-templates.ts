/**
 * Seed script for notification templates.
 *
 * Usage:
 *  npx tsx scripts/seed-notification-templates.ts
 *
 * Loads .env.local, then seeds default notification templates for all event types
 * across EMAIL and SMS channels. Skips existing templates (no duplicates).
 *
 * Uses template variables that the outbox handlers actually populate:
 *   {{studentName}}, {{requestNumber}}, {{dates}}, {{reason}},
 *   {{expectedReturnDate}}, {{decision}}, {{approvalLink}}
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Dynamic imports — must come AFTER dotenv.config() because static imports
// are hoisted and would load @/lib/db before the env file is read.
async function main() {
  const { notificationTemplateRepository } = await import(
    "@/db/repositories/notification/notification-template.repository"
  );
  const { NOTIFICATION_EVENT } = await import(
    "@/constants/notification/notification-event"
  );

  type ChannelType = "EMAIL" | "SMS" | "PUSH" | "WEBHOOK" | "SLACK";

  type TemplateInput = {
    eventKey: string;
    channel: ChannelType;
    subject?: string;
    templateBody: string;
    isActive: boolean;
  };

  const TEMPLATES: TemplateInput[] = [
    // ── LEAVE SUBMITTED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: "EMAIL",
      subject: "Leave Submitted — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave request has been submitted successfully.`,
        ``,
        `Request #: {{requestNumber}}`,
        `Dates: {{dates}}`,
        `Reason: {{reason}}`,
        ``,
        `You will be notified when your leave is reviewed.`,
      ].join("\n"),
      isActive: true,
    },

    // ── LEAVE APPROVED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: "EMAIL",
      subject: "Leave Approved — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave request has been APPROVED.`,
        ``,
        `Request #: {{requestNumber}}`,
        `Dates: {{dates}}`,
        ``,
        `You can now generate your QR pass for movement.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: "SMS",
      templateBody: `{{studentName}}, your leave ({{dates}}) is APPROVED. Generate your QR pass to move out.`,
      isActive: true,
    },

    // ── LEAVE REJECTED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: "EMAIL",
      subject: "Leave Rejected — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave request has been REJECTED.`,
        ``,
        `Request #: {{requestNumber}}`,
        `Dates: {{dates}}`,
        `Reason: {{reason}}`,
        ``,
        `If you have questions, contact your warden or POC.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: "SMS",
      templateBody: `{{studentName}}, your leave ({{dates}}) was REJECTED. Reason: {{reason}}. Contact your warden.`,
      isActive: true,
    },

    // ── LEAVE CANCELLED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_CANCELLED,
      channel: "EMAIL",
      subject: "Leave Cancelled — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave ({{dates}}) has been cancelled.`,
        ``,
        `If this was a mistake, please submit a new leave request.`,
      ].join("\n"),
      isActive: true,
    },

    // ── LEAVE COMPLETED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_COMPLETED,
      channel: "EMAIL",
      subject: "Leave Completed — Welcome Back",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Welcome back! Your leave has been marked as completed.`,
        ``,
        `Dates: {{dates}}`,
        ``,
        `Thank you.`,
      ].join("\n"),
      isActive: true,
    },

    // ── LEAVE EXPIRED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXPIRED,
      channel: "EMAIL",
      subject: "Leave Expired — Overdue Return",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave has EXPIRED. You were expected to return by {{expectedReturnDate}}.`,
        ``,
        `Please report to the warden/POC immediately.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXPIRED,
      channel: "SMS",
      templateBody: `ALERT: Your leave has EXPIRED. Expected return: {{expectedReturnDate}}. Report to the warden.`,
      isActive: true,
    },

    // ── LEAVE EXTENSION REQUESTED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_REQUESTED,
      channel: "EMAIL",
      subject: "Extension Requested — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your extension request has been submitted.`,
        ``,
        `Dates: {{dates}}`,
        `Reason: {{reason}}`,
        ``,
        `You will be notified when a decision is made.`,
      ].join("\n"),
      isActive: true,
    },

    // ── LEAVE EXTENSION APPROVED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_APPROVED,
      channel: "EMAIL",
      subject: "Extension Approved — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave extension has been APPROVED.`,
        ``,
        `Dates: {{dates}}`,
        ``,
        `Please ensure you return by the new end date.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_APPROVED,
      channel: "SMS",
      templateBody: `{{studentName}}, your extension has been APPROVED ({{dates}}).`,
      isActive: true,
    },

    // ── LEAVE EXTENSION REJECTED ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_REJECTED,
      channel: "EMAIL",
      subject: "Extension Rejected — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave extension has been REJECTED.`,
        ``,
        `You must return by your original end date.`,
        ``,
        `Dates: {{dates}}`,
        ``,
        `If you have questions, contact the warden/POC.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXTENSION_REJECTED,
      channel: "SMS",
      templateBody: `{{studentName}}, your extension was REJECTED ({{dates}}). Return by original end date.`,
      isActive: true,
    },

    // ── LEAVE OVERDUE ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_OVERDUE,
      channel: "EMAIL",
      subject: "Leave Overdue — {{studentName}}",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your leave is OVERDUE.`,
        ``,
        `Expected return: {{expectedReturnDate}}`,
        ``,
        `Please return to the hostel immediately and report to the warden.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_OVERDUE,
      channel: "SMS",
      templateBody: `URGENT: Leave OVERDUE. Expected return: {{expectedReturnDate}}. Return immediately!`,
      isActive: true,
    },

    // ── PARENT APPROVAL REQUESTED ──
    {
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: "SMS",
      templateBody: `{{studentName}} requests leave approval ({{dates}}): {{reason}}. Approve: {{approvalLink}}`,
      isActive: true,
    },

    // ── QR GENERATED ──
    {
      eventKey: NOTIFICATION_EVENT.QR_GENERATED,
      channel: "EMAIL",
      subject: "Your QR Pass is Ready",
      templateBody: [
        `Dear {{studentName}},`,
        ``,
        `Your QR pass is ready for leave ({{dates}}).`,
        ``,
        `View it in the student portal.`,
        `Do not share your QR code with others.`,
        `Present it at the gate when exiting and returning.`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.QR_GENERATED,
      channel: "SMS",
      templateBody: `QR pass ready for leave ({{dates}}). View in student portal. Do not share your QR.`,
      isActive: true,
    },

    // ── SLACK NOTIFICATIONS ──
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: "SLACK",
      subject: "📋 New Leave Request",
      templateBody: [
        `*Student:* {{studentName}}`,
        `*Request #:* {{requestNumber}}`,
        `*Dates:* {{dates}}`,
        `*Reason:* {{reason}}`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: "SLACK",
      subject: "✅ Leave Approved",
      templateBody: [
        `*Student:* {{studentName}}`,
        `*Request #:* {{requestNumber}}`,
        `*Dates:* {{dates}}`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: "SLACK",
      subject: "❌ Leave Rejected",
      templateBody: [
        `*Student:* {{studentName}}`,
        `*Request #:* {{requestNumber}}`,
        `*Dates:* {{dates}}`,
        `*Reason:* {{reason}}`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_EXPIRED,
      channel: "SLACK",
      subject: "⚠️ Leave Expired",
      templateBody: [
        `*Student:* {{studentName}}`,
        `*Request #:* {{requestNumber}}`,
        `*Expected return:* {{expectedReturnDate}}`,
      ].join("\n"),
      isActive: true,
    },
    {
      eventKey: NOTIFICATION_EVENT.LEAVE_OVERDUE,
      channel: "SLACK",
      subject: "🚨 Leave Overdue",
      templateBody: [
        `*Student:* {{studentName}}`,
        `*Request #:* {{requestNumber}}`,
        `*Expected return:* {{expectedReturnDate}}`,
      ].join("\n"),
      isActive: true,
    },
  ];

  console.log("Seeding notification templates...\n");

  let created = 0;
  let skipped = 0;

  for (const template of TEMPLATES) {
    const existing = await notificationTemplateRepository.findByEventAndChannel(
      template.eventKey,
      template.channel,
    );

    if (existing) {
      console.log(`  SKIP [${template.channel}] ${template.eventKey} — already exists`);
      skipped++;
      continue;
    }

    await notificationTemplateRepository.create({
      code: `${template.eventKey.toLowerCase()}_${template.channel.toLowerCase()}`,
      eventKey: template.eventKey,
      channel: template.channel,
      subject: template.subject ?? null,
      templateBody: template.templateBody,
      isActive: template.isActive,
      metadata: { source: "seed" },
    });

    console.log(`  CREATE [${template.channel}] ${template.eventKey}${template.subject ? ` — ${template.subject}` : ""}`);
    created++;
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`);
}

main()
  .then(() => {
    console.log("\nSeed completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  });
