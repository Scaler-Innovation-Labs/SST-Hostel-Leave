import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0015 (leave-approval-required event)...");

  // The LEAVE_APPROVAL_REQUIRED outbox event fires when a later workflow
  // step becomes current (e.g. admin review after POC approval). Rules and
  // templates reference it via the notification_event enum.
  await db.execute(sql`
    ALTER TYPE "public"."notification_event" ADD VALUE IF NOT EXISTS 'LEAVE_APPROVAL_REQUIRED';
  `);
  console.log("  - LEAVE_APPROVAL_REQUIRED added to notification_event");

  // HOSTEL_ADMIN recipient type: resolves the ADMINs of the student's own
  // hostel, so late-stay admin-review alerts reach the right admin only.
  await db.execute(sql`
    ALTER TYPE "public"."notification_recipient_type" ADD VALUE IF NOT EXISTS 'HOSTEL_ADMIN';
  `);
  console.log("  - HOSTEL_ADMIN added to notification_recipient_type");

  console.log("Migration 0015 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
