import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0026 (audit P1 cleanups)...");
  console.log(
    "  Covers: policy_evaluations.inputs rename, outbox lease/retry/dead-letter," +
    " audit retention columns, workflow_definitions.version removal, duplicate index cleanup"
  );

  // ------------------------------------------------------------------
  // 1. policy_evaluations: config -> inputs
  //    The rule definition already lives immutably in policy_versions;
  //    evaluations only need the resolved request inputs.
  // ------------------------------------------------------------------
  const policyCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name IN ('config', 'inputs');
  `);
  const hasConfig = policyCols.rows.some((r: any) => r.column_name === "config");

  if (hasConfig) {
    await db.execute(sql`
      ALTER TABLE "policy_evaluations" RENAME COLUMN "config" TO "inputs";
    `);
    console.log("  - renamed policy_evaluations.config -> inputs");

    // Legacy rows stored { rule, inputs } — strip to the resolved inputs so
    // all rows share the same shape as new writes.
    await db.execute(sql`
      UPDATE "policy_evaluations"
      SET "inputs" = "inputs" -> 'inputs'
      WHERE "inputs" IS NOT NULL AND "inputs" ? 'rule';
    `);
    console.log("  - backfilled legacy {rule, inputs} rows to inputs-only shape");
  } else {
    console.log("  - policy_evaluations already migrated (skipping rename)");
  }

  // ------------------------------------------------------------------
  // 2. outbox_events: retry scheduling + lease semantics + dead-letter
  // ------------------------------------------------------------------
  await db.execute(sql`
    ALTER TABLE "outbox_events"
    ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamptz;
  `);

  await db.execute(sql`
    ALTER TABLE "outbox_events"
    ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamptz;
  `);
  console.log("  - added outbox next_attempt_at and lease_expires_at");

  // Enum value must be added before it can be referenced by any row.
  await db.execute(sql`
    ALTER TYPE "outbox_status" ADD VALUE IF NOT EXISTS 'DEAD_LETTER' AFTER 'FAILED';
  `);
  console.log("  - added DEAD_LETTER to outbox_status enum");

  // Claim-loop index: find PENDING events ready for their next attempt.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "oe_status_next_attempt_idx"
    ON "outbox_events" ("status", "next_attempt_at");
  `);
  console.log("  - created oe_status_next_attempt_idx");

  // ------------------------------------------------------------------
  // 3. audit_logs: retention class + expiry
  //    Existing rows keep NULL expiresAt (= retain forever) — only rows
  //    written after this migration get a computed expiry.
  // ------------------------------------------------------------------
  await db.execute(sql`
    ALTER TABLE "audit_logs"
    ADD COLUMN IF NOT EXISTS "retention_class" text NOT NULL DEFAULT 'STATE_TRANSITION';
  `);

  await db.execute(sql`
    ALTER TABLE "audit_logs"
    ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_expires_at_idx"
    ON "audit_logs" ("expires_at");
  `);
  console.log("  - added audit_logs retention_class, expires_at + index");

  // ------------------------------------------------------------------
  // 4. workflow_definitions: drop duplicate version counter
  //    The immutable history lives in workflow_versions; the mutable
  //    definition does not need its own version number.
  // ------------------------------------------------------------------
  const wfCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'workflow_definitions' AND column_name = 'version';
  `);

  if (wfCols.rows.length > 0) {
    await db.execute(sql`
      ALTER TABLE "workflow_definitions" DROP COLUMN "version";
    `);
    console.log("  - dropped workflow_definitions.version");
  } else {
    console.log("  - workflow_definitions.version already dropped (skipping)");
  }

  // ------------------------------------------------------------------
  // 5. Drop redundant indexes covered by UNIQUE constraints
  //    A UNIQUE constraint already creates an index on its column(s).
  // ------------------------------------------------------------------
  await db.execute(sql`
    DROP INDEX IF EXISTS "leave_requests_request_number_idx";
  `);

  await db.execute(sql`
    DROP INDEX IF EXISTS "users_clerk_id_idx";
  `);

  await db.execute(sql`
    DROP INDEX IF EXISTS "users_email_idx";
  `);
  console.log("  - dropped indexes duplicated by unique constraints");

  console.log("Migration 0026 complete.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
