import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Updates the live-DB PARENT_APPROVAL_REQUESTED SMS templates to the current
 * seed copy: the student's name variable is now {{StudentApprovalName}}
 * (renamed from {{parentApprovalName}}).
 *
 * Usage:
 *   npx tsx scripts/update-parent-sms-templates.ts
 *
 * Only touches PARENT_APPROVAL_REQUESTED + SMS templates. Uses the same
 * onConflictDoUpdate upsert as seedNotificationTemplates().
 */
async function main() {
  const { db } = await import("@/lib/db");
  const { notificationTemplates } = await import("@/db");
  const { NOTIFICATION_EVENT } = await import(
    "@/constants/notification/notification-event"
  );
  const { LEAVE_TYPE_TEMPLATES } = await import(
    "@/db/seed/notification-templates.seed"
  );

  const parentSmsTemplates = Object.values(LEAVE_TYPE_TEMPLATES)
    .flat()
    .filter(
      (t) =>
        t.eventKey === NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED &&
        t.channel === "SMS",
    );

  console.log(
    `Updating ${parentSmsTemplates.length} parent-approval SMS templates...\n`,
  );

  for (const template of parentSmsTemplates) {
    await db
      .insert(notificationTemplates)
      .values({
        code: template.code,
        eventKey: template.eventKey,
        channel: template.channel as "SMS",
        subject: template.subject,
        templateBody: template.templateBody,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: notificationTemplates.code,
        set: {
          subject: template.subject,
          templateBody: template.templateBody,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    console.log(`  UPDATED ${template.code}`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Update failed:", error);
  process.exit(1);
});
