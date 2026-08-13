import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0019 (leave_status OVERDUE value)...");

  // OVERDUE = student checked out for the leave (QR scanned) but did not
  // return to the hostel by the leave end date. Distinct from EXPIRED,
  // which means the leave was approved but never checked out.
  await db.execute(sql`
    ALTER TYPE leave_status ADD VALUE IF NOT EXISTS 'OVERDUE';
  `);
  console.log("  - added leave_status enum value OVERDUE");

  console.log("Migration 0019 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));