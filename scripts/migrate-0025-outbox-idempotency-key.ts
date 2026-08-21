import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0025 (outbox idempotency key)...");

  // Add idempotencyKey column to outbox_events
  await db.execute(sql`
    ALTER TABLE "outbox_events"
    ADD COLUMN IF NOT EXISTS "idempotency_key" text;
  `);
  console.log("  - added idempotency_key column");

  // Create unique index on idempotency_key (only non-null values)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_idempotency_key_unique_idx"
    ON "outbox_events" ("idempotency_key")
    WHERE "idempotency_key" IS NOT NULL;
  `);
  console.log("  - created unique index on idempotency_key (partial)");

  console.log("Migration 0025 complete.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });