import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0010...");

  // ── QR pass raw token ────────────────────────────────────────────────
  // One QR token per approved leave, generated once and stable for the life
  // of the leave. The raw token is stored so both the student app and the
  // approval email can render the same scannable QR; `token_hash` remains
  // the lookup key for gate scans.
  await db.execute(sql`
    ALTER TABLE qr_passes
    ADD COLUMN IF NOT EXISTS token text;
  `);
  console.log("  - added qr_passes.token");

  console.log("Migration 0010 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
