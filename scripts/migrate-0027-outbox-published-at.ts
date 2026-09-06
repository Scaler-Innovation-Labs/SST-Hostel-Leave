import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0027 (outbox SQS publish marker)...");

  // Delivery state (published to SQS) tracked independently from
  // processing state. NULL = never published. Existing rows keep NULL:
  // the recovery publisher picks them up on its first run.
  await db.execute(sql`
    ALTER TABLE "outbox_events"
    ADD COLUMN IF NOT EXISTS "published_at" timestamptz;
  `);
  console.log("  - added outbox_events.published_at");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "oe_status_published_idx"
    ON "outbox_events" ("status", "published_at");
  `);
  console.log("  - created oe_status_published_idx");

  console.log("Migration 0027 complete.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
