import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0005...");

  await db.execute(sql`
    ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;
  `);
  console.log("  - read_at column added to notification_logs");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS notification_logs_read_at_idx
    ON notification_logs (read_at);
  `);
  console.log("  - read_at index created");

  console.log("Migration 0005 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
