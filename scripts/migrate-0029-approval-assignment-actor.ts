import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Expand migration: retain approver_user_id for a rollback/reconciliation
// window. New application code no longer reads or writes that ambiguous field.
// Drop the legacy column only in a later contract migration after verification.

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0029 (approval assignment/actor separation)...");

  await db.execute(sql`
    ALTER TABLE "leave_approvals"
    ADD COLUMN IF NOT EXISTS "assigned_approver_user_id" uuid
      REFERENCES "users"("id") ON DELETE SET NULL;
  `);
  await db.execute(sql`
    ALTER TABLE "leave_approvals"
    ADD COLUMN IF NOT EXISTS "acted_by_user_id" uuid
      REFERENCES "users"("id") ON DELETE SET NULL;
  `);

  const columns = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'leave_approvals'
      AND column_name IN ('approver_user_id', 'assigned_approver_user_id', 'acted_by_user_id');
  `);
  const names = new Set(columns.rows.map((row: any) => row.column_name as string));

  if (names.has("approver_user_id")) {
    // The old field held an assignment while rows were unprocessed.
    // Bulk cancellation preserves that assignment rather than recording an actor.
    await db.execute(sql`
      UPDATE "leave_approvals"
      SET "assigned_approver_user_id" = "approver_user_id"
      WHERE "assigned_approver_user_id" IS NULL
        AND "approver_user_id" IS NOT NULL
        AND "decision"::text IN ('PENDING', 'CANCELLED');
    `);

    // updateDecisionById wrote the acting user's ID into the old field for
    // normal APPROVED/REJECTED decisions. A NULL parent-link actor stays NULL.
    // SYSTEM auto-approvals are excluded.
    await db.execute(sql`
      UPDATE "leave_approvals"
      SET "acted_by_user_id" = "approver_user_id"
      WHERE "acted_by_user_id" IS NULL
        AND "approver_user_id" IS NOT NULL
        AND "decision"::text IN ('APPROVED', 'REJECTED')
        AND "approval_source"::text <> 'SYSTEM';
    `);

    const check = await db.execute(sql`
      SELECT COUNT(*)::int AS missing
      FROM "leave_approvals"
      WHERE "decision"::text = 'PENDING'
        AND "approver_user_id" IS NOT NULL
        AND "assigned_approver_user_id" IS NULL;
    `);
    const missing = Number((check.rows[0] as any)?.missing ?? 0);
    if (missing > 0) {
      throw new Error(`Backfill verification failed: ${missing} pending assigned row(s) were not copied.`);
    }
    console.log("  - backfilled pending/cancelled assignments and known user actors");
    console.log("  - retained legacy approver_user_id for rollback/reconciliation");
  } else {
    console.log("  - legacy approver_user_id absent; backfill skipped");
  }

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "la_assigned_approver_user_id_idx"
    ON "leave_approvals" ("assigned_approver_user_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "la_acted_by_user_id_idx"
    ON "leave_approvals" ("acted_by_user_id");
  `);

  console.log("Migration 0029 complete. Legacy column has NOT been dropped.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
