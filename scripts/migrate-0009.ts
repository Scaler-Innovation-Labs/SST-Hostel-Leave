import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0009...");

  // ── Remove POC Slack tag ─────────────────────────────────────────────
  // The hostel-level "POC Slack Tag" (slack_poc_group_id) is no longer used;
  // Slack mentions CC only the hostel's admin group now.
  await db.execute(sql`
    ALTER TABLE hostels
    DROP COLUMN IF EXISTS slack_poc_group_id;
  `);
  console.log("  - dropped hostels.slack_poc_group_id");

  console.log("Migration 0009 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
