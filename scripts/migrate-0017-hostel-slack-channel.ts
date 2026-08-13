import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0017 (hostel slack channel)...");

  // Per-hostel Slack channel for admin/staff Slack alerts. POC alerts keep
  // using the global SLACK_POC_CHANNEL_ID; admin alerts post to the hostel's
  // channel when set, falling back to SLACK_CHANNEL_ID otherwise.
  await db.execute(sql`
    ALTER TABLE hostels
    ADD COLUMN IF NOT EXISTS slack_channel_id text;
  `);
  console.log("  - added hostels.slack_channel_id");

  // Backfill the two seeded hostels with their admin channels (only where
  // still unset, so admin-configured values are never overwritten).
  const backfills = [
    { code: "UNI-1", channel: "#leave-hostel-neeladri" },
    { code: "UNI-2", channel: "#leave-hostel-velankani" },
  ];
  for (const { code, channel } of backfills) {
    const result = await db.execute(sql`
      UPDATE hostels
      SET slack_channel_id = ${channel}
      WHERE code = ${code} AND slack_channel_id IS NULL
      RETURNING id;
    `);
    console.log(`  - ${code} -> ${channel} (${result.rowCount ?? 0} row(s) updated)`);
  }

  console.log("Migration 0017 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
