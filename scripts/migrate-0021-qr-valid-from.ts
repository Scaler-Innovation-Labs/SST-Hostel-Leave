import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0021 (qr_passes.valid_from)...");

  // Contract (docs/movement-contract.md §2): a QR pass has a usability window
  // — validFrom (= leave startAt) to expiresAt (= leave endAt + 24h return
  // grace). Future approved leaves hold ACTIVE-but-gated passes: the record
  // exists (email QR renders) but the token is not scannable until validFrom.
  await db.execute(sql`
    ALTER TABLE qr_passes
    ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone;
  `);
  console.log("  - added qr_passes.valid_from");

  // Backfill valid_from from the owning leave's startAt (only where unset).
  const validFromBackfill = await db.execute(sql`
    UPDATE qr_passes qp
    SET valid_from = lr.start_at
    FROM leave_requests lr
    WHERE qp.leave_request_id = lr.id
      AND qp.valid_from IS NULL;
  `);
  console.log(`  - backfilled valid_from (${validFromBackfill.rowCount ?? 0} row(s))`);

  // Backfill expires_at = leave endAt + 24h return grace where still null, so
  // unused passes expire with their leave and the cleanup job can retire them.
  // Return scans ignore this bound (an overdue student may still check back in).
  const expiresBackfill = await db.execute(sql`
    UPDATE qr_passes qp
    SET expires_at = lr.end_at + interval '24 hours'
    FROM leave_requests lr
    WHERE qp.leave_request_id = lr.id
      AND qp.expires_at IS NULL;
  `);
  console.log(`  - backfilled expires_at (end_at + 24h) (${expiresBackfill.rowCount ?? 0} row(s))`);

  console.log("Migration 0021 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
