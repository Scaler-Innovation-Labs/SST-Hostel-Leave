import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0024 (dead schema removal)...");

  // ---- Dead tables (never written or read by any code path) ----
  // inbound_sms_logs / sheet_sync_logs: designed for parent SMS-reply and
  // Google Sheets sync features that were never built (no webhook route,
  // no repository, no service, no integration exists).
  // parent_otp_sessions: abandoned parent-OTP design recreated by
  // migrate-0004; superseded by tokenized approval links on leave_approvals.
  await db.execute(sql`
    DROP TABLE IF EXISTS "inbound_sms_logs";
  `);
  console.log("  - dropped inbound_sms_logs");

  await db.execute(sql`
    DROP TABLE IF EXISTS "sheet_sync_logs";
  `);
  console.log("  - dropped sheet_sync_logs");

  await db.execute(sql`
    DROP TABLE IF EXISTS "parent_otp_sessions";
  `);
  console.log("  - dropped parent_otp_sessions");

  // ---- Orphaned enum types (consumed only by the dropped tables) ----
  await db.execute(sql`
    DROP TYPE IF EXISTS "sms_parsed_action";
  `);
  await db.execute(sql`
    DROP TYPE IF EXISTS "sms_processing_status";
  `);
  await db.execute(sql`
    DROP TYPE IF EXISTS "sheet_sync_status";
  `);
  console.log("  - dropped orphaned enums (sms_parsed_action, sms_processing_status, sheet_sync_status)");

  // ---- Unused columns (never written or read; indexes drop with columns) ----
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at";
  `);
  await db.execute(sql`
    ALTER TABLE "parents" DROP COLUMN IF EXISTS "metadata";
  `);
  await db.execute(sql`
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "approval_snapshot";
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "request_version";
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "leave_type_version";
  `);
  await db.execute(sql`
    ALTER TABLE "leave_extensions" DROP COLUMN IF EXISTS "approval_snapshot";
    ALTER TABLE "leave_extensions" DROP COLUMN IF EXISTS "metadata";
  `);
  await db.execute(sql`
    ALTER TABLE "leave_approvals" DROP COLUMN IF EXISTS "metadata";
    ALTER TABLE "leave_approvals" DROP COLUMN IF EXISTS "parent_approval_otp_hash";
    ALTER TABLE "leave_approvals" DROP COLUMN IF EXISTS "parent_approval_verified_at";
  `);
  await db.execute(sql`
    ALTER TABLE "leave_rejections" DROP COLUMN IF EXISTS "metadata";
  `);
  console.log("  - dropped unused columns (users, parents, leave_requests, leave_extensions, leave_approvals, leave_rejections)");

  console.log("Migration 0024 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));