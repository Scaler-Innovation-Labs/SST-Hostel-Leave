import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Idempotent seed: recurring late-stay authorization notification wiring.
 *
 * Inserts the six lifecycle templates + rules without touching any other
 * seeded data (safe to run on a live database, unlike clear-and-seed).
 * Re-running updates templates in place and skips existing rules.
 */
async function main() {
  const { db } = await import("@/lib/db");
  const { and, eq } = await import("drizzle-orm");
  const { leaveTypes, notificationRuleChannels, notificationRuleRecipients, notificationRules, notificationTemplates } =
    await import("@/db");

  console.log("Seeding recurring late-stay authorization notification wiring...");

  const leaveTypeRow = await db
    .select({ id: leaveTypes.id })
    .from(leaveTypes)
    .where(eq(leaveTypes.code, "LATE_STAY_COLLEGE"))
    .limit(1);

  const leaveTypeId = leaveTypeRow[0]?.id ?? null;
  if (!leaveTypeId) {
    throw new Error("LATE_STAY_COLLEGE leave type not found — seed leave types first");
  }

  const templates: Array<{
    code: string;
    eventKey: string;
    channel: "EMAIL" | "SMS" | "SLACK";
    subject: string | null;
    templateBody: string;
  }> = [
    {
      code: "late_stay_auth_submitted_slack_poc",
      eventKey: "LATE_STAY_AUTH_SUBMITTED",
      channel: "SLACK",
      subject: null,
      templateBody:
        "A new recurring late-stay authorization has been requested by {{studentName}}.\n" +
        "Valid: {{validFrom}} to {{validUntil}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it in the hostel portal.",
    },
    {
      code: "late_stay_auth_step_approved_slack_admin",
      eventKey: "LATE_STAY_AUTH_STEP_APPROVED",
      channel: "SLACK",
      subject: null,
      templateBody:
        "The POC has approved a recurring late-stay authorization for {{studentName}} ({{validFrom}} to {{validUntil}}).\n" +
        "Admin review is now required before it becomes active.",
    },
    {
      code: "late_stay_auth_active_email_student",
      eventKey: "LATE_STAY_AUTH_ACTIVE",
      channel: "EMAIL",
      subject: "Recurring Late Stay Authorization Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your recurring late-stay authorization for {{validFrom}} to {{validUntil}} has been approved.\n\n" +
        "On any day you intend to stay late within your authorized window, submit your claim in the portal before heading out. Your claim creates that night's approved late-stay pass.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "late_stay_auth_rejected_email_student",
      eventKey: "LATE_STAY_AUTH_REJECTED",
      channel: "EMAIL",
      subject: "Recurring Late Stay Authorization Declined",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request for a recurring late-stay authorization ({{validFrom}} to {{validUntil}}) has been declined.\n\n" +
        "For any clarification, please coordinate with your POC or Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "late_stay_auth_revoked_email_student",
      eventKey: "LATE_STAY_AUTH_REVOKED",
      channel: "EMAIL",
      subject: "Recurring Late Stay Authorization Revoked",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your recurring late-stay authorization has been revoked and is no longer valid.\n\n" +
        "Reason: {{reason}}\n\n" +
        "Future late stays will require a fresh application.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "late_stay_auth_expired_email_student",
      eventKey: "LATE_STAY_AUTH_EXPIRED",
      channel: "EMAIL",
      subject: "Recurring Late Stay Authorization Expired",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your recurring late-stay authorization (ended {{validUntil}}) has expired.\n\n" +
        "If you still need to stay late on campus, please submit a new request.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
  ];

  const rules: Array<{
    eventType: string;
    templateCode: string;
    recipientTypes: string[];
    channels: string[];
  }> = [
    {
      eventType: "LATE_STAY_AUTH_SUBMITTED",
      templateCode: "late_stay_auth_submitted_slack_poc",
      recipientTypes: ["POC"],
      channels: ["SLACK"],
    },
    {
      eventType: "LATE_STAY_AUTH_STEP_APPROVED",
      templateCode: "late_stay_auth_step_approved_slack_admin",
      recipientTypes: ["HOSTEL_ADMIN"],
      channels: ["SLACK"],
    },
    {
      eventType: "LATE_STAY_AUTH_ACTIVE",
      templateCode: "late_stay_auth_active_email_student",
      recipientTypes: ["STUDENT"],
      channels: ["EMAIL"],
    },
    {
      eventType: "LATE_STAY_AUTH_REJECTED",
      templateCode: "late_stay_auth_rejected_email_student",
      recipientTypes: ["STUDENT"],
      channels: ["EMAIL"],
    },
    {
      eventType: "LATE_STAY_AUTH_REVOKED",
      templateCode: "late_stay_auth_revoked_email_student",
      recipientTypes: ["STUDENT"],
      channels: ["EMAIL"],
    },
    {
      eventType: "LATE_STAY_AUTH_EXPIRED",
      templateCode: "late_stay_auth_expired_email_student",
      recipientTypes: ["STUDENT"],
      channels: ["EMAIL"],
    },
  ];

  let inserted = 0;

  for (const template of templates) {
    await db
      .insert(notificationTemplates)
      .values({
        code: template.code,
        eventKey: template.eventKey as never,
        channel: template.channel,
        leaveTypeId,
        subject: template.subject,
        templateBody: template.templateBody,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: notificationTemplates.code,
        set: {
          subject: template.subject,
          templateBody: template.templateBody,
          leaveTypeId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  - ensured ${templates.length} templates`);

  for (const rule of rules) {
    const templateRow = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.code, rule.templateCode))
      .limit(1);

    const templateId = templateRow[0]?.id;
    if (!templateId) {
      console.warn(`  ! template missing for rule: ${rule.templateCode}`);
      continue;
    }

    // Skip if this rule already exists for the leave type + event + template.
    const existing = await db
      .select({ id: notificationRules.id })
      .from(notificationRules)
      .where(
        and(
          eq(notificationRules.leaveTypeId, leaveTypeId),
          eq(notificationRules.eventType, rule.eventType as never),
          eq(notificationRules.templateId, templateId)
        )
      )
      .limit(1);

    if (existing[0]) continue;

    const [created] = await db
      .insert(notificationRules)
      .values({
        leaveTypeId,
        eventType: rule.eventType as never,
        templateId,
        enabled: true,
        customRecipients: null,
      })
      .returning();

    if (!created) continue;

    if (rule.recipientTypes.length > 0) {
      await db.insert(notificationRuleRecipients).values(
        rule.recipientTypes.map((r) => ({
          ruleId: created.id,
          recipientType: r as never,
        }))
      );
    }
    if (rule.channels.length > 0) {
      await db.insert(notificationRuleChannels).values(
        rule.channels.map((c) => ({
          ruleId: created.id,
          channel: c as never,
        }))
      );
    }
    inserted += 1;
  }

  console.log(`  - inserted ${inserted} rules (existing skipped)`);
  console.log("Late-stay authorization notification seeding complete.");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
