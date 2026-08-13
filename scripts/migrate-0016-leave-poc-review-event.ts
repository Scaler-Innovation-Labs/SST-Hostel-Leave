import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0016 (poc-review-required event)...");

  // LEAVE_APPROVAL_REQUIRED fires when any later workflow step becomes
  // current. The handler now dispatches to LEAVE_POC_REVIEW_REQUIRED when the
  // step that became current is a POC step (so POC alerts fire only after the
  // parent has approved), while admin-step transitions keep using
  // LEAVE_APPROVAL_REQUIRED.
  await db.execute(sql`
    ALTER TYPE "public"."notification_event" ADD VALUE IF NOT EXISTS 'LEAVE_POC_REVIEW_REQUIRED';
  `);
  console.log("  - LEAVE_POC_REVIEW_REQUIRED added to notification_event");

  console.log("Migration 0016 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
