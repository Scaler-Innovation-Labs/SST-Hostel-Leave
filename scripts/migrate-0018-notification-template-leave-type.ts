import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0018 (notification template leave type)...");

  // Link each notification template to its leave type so the fallback
  // notification path only sends the template for the matching leave type
  // (previously it sent every active template for the event — e.g. six
  // parent-approval SMS for one leave). NULL = global template for the event.
  await db.execute(sql`
    ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS leave_type_id uuid REFERENCES leave_types(id) ON DELETE SET NULL;
  `);
  console.log("  - added notification_templates.leave_type_id");

  console.log("Migration 0018 complete!");
  console.log("  Next: run `pnpm exec tsx scripts/seed-notification-wiring.ts` to backfill leave_type_id on existing rows.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
