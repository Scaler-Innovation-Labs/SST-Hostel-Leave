import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0020 (outbox_events claimed_at)...");

  // claimed_at records when a worker claimed a PENDING event for
  // processing. It lets the outbox cron detect and requeue PROCESSING
  // events whose worker died mid-processing (crash recovery).
  await db.execute(sql`
    ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
  `);
  console.log("  - added outbox_events.claimed_at column");

  console.log("Migration 0020 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));