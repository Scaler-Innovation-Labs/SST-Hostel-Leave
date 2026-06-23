import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0003...");

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_method') THEN
        CREATE TYPE "public"."approval_method" AS ENUM('PORTAL', 'OTP', 'SMS_REPLY', 'EMAIL_LINK', 'AUTO');
      END IF;
    END $$;
  `);
  console.log("  - approval_method enum created");

  await db.execute(sql`
    ALTER TYPE "public"."approval_source" ADD VALUE IF NOT EXISTS 'PORTAL';
  `);
  console.log("  - PORTAL added to approval_source");

  await db.execute(sql`
    ALTER TYPE "public"."approval_source" ADD VALUE IF NOT EXISTS 'SMS_REPLY';
  `);
  console.log("  - SMS_REPLY added to approval_source");

  await db.execute(sql`
    ALTER TYPE "public"."approval_source" ADD VALUE IF NOT EXISTS 'EMAIL_LINK';
  `);
  console.log("  - EMAIL_LINK added to approval_source");

  await db.execute(sql`
    ALTER TABLE "workflow_steps" ADD COLUMN IF NOT EXISTS "approval_method" "approval_method";
  `);
  console.log("  - approval_method column added to workflow_steps");

  console.log("Migration 0003 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
