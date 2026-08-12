import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Restores the live-DB LEAVE_APPROVED email templates to the current seed
 * copy (embedded QR image with the "Your QR Pass" wording).
 *
 * Usage:
 *   npx tsx scripts/update-approval-templates.ts
 *
 * Only touches LEAVE_APPROVED + EMAIL templates. Uses the same
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

  const approvalTemplates = Object.values(LEAVE_TYPE_TEMPLATES)
    .flat()
    .filter(
      (t) =>
        t.eventKey === NOTIFICATION_EVENT.LEAVE_APPROVED &&
        t.channel === "EMAIL",
    );

  console.log(
    `Updating ${approvalTemplates.length} LEAVE_APPROVED email templates...\n`,
  );

  for (const template of approvalTemplates) {
    await db
      .insert(notificationTemplates)
      .values({
        code: template.code,
        eventKey: template.eventKey,
        channel: template.channel as "EMAIL",
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
