import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.worker") });

// Migration 0031: Parent Approval Details Model Extraction
// 1. Create leave_approval_parent_details table
// 2. Enforce foreign keys (CASCADE on approval_id, RESTRICT on parent_id)
// 3. Enforce token_hash uniqueness
// 4. Enforce num_nonnulls(token_hash, token_expires_at) IN (0, 2) check constraint
// 5. Create performance indexes
// 6. Backfill existing parent approvals from leave_approvals
// 7. Verify 100% data fidelity between leave_approvals and leave_approval_parent_details

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0031 (parent approval details model extraction)...");

  // Step 1: Pre-flight source checks
  console.log("  1/4 Verifying source data integrity in leave_approvals...");
  const preflightResult = await db.execute(sql`
    SELECT 
      COUNT(*)::int AS source_parent_approvals,
      COUNT(DISTINCT id)::int AS source_distinct_approvals,
      COUNT(parent_approval_token)::int AS source_tokens,
      COUNT(DISTINCT parent_approval_token)::int AS source_distinct_tokens
    FROM "leave_approvals"
    WHERE "approver_parent_id" IS NOT NULL;
  `);

  const preflightRows = ((preflightResult as any).rows ?? preflightResult) as Array<{
    source_parent_approvals: number;
    source_distinct_approvals: number;
    source_tokens: number;
    source_distinct_tokens: number;
  }>;

  const preflight = preflightRows[0]!;

  console.log(`      Source parent approvals: ${preflight.source_parent_approvals} (distinct: ${preflight.source_distinct_approvals})`);
  console.log(`      Source tokens: ${preflight.source_tokens} (distinct: ${preflight.source_distinct_tokens})`);

  if (preflight.source_parent_approvals !== preflight.source_distinct_approvals) {
    throw new Error("Preflight failed: Duplicate approval IDs detected in source parent approvals!");
  }
  if (preflight.source_tokens !== preflight.source_distinct_tokens) {
    throw new Error("Preflight failed: Duplicate token hashes detected in source parent approvals!");
  }

  // Step 2: Create child table and constraints
  console.log("  2/4 Creating leave_approval_parent_details table and constraints...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leave_approval_parent_details" (
      "approval_id" uuid PRIMARY KEY REFERENCES "leave_approvals"("id") ON DELETE CASCADE,
      "parent_id" uuid NOT NULL REFERENCES "parents"("id") ON DELETE RESTRICT,
      "token_hash" text UNIQUE,
      "token_expires_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "parent_details_token_valid_chk"
        CHECK (num_nonnulls(token_hash, token_expires_at) IN (0, 2))
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lapd_parent_id_idx"
      ON "leave_approval_parent_details" ("parent_id");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "lapd_token_expires_idx"
      ON "leave_approval_parent_details" ("token_expires_at");
  `);

  // Step 3: Idempotent backfill from leave_approvals
  console.log("  3/4 Backfilling parent approvals into leave_approval_parent_details...");
  await db.execute(sql`
    INSERT INTO "leave_approval_parent_details" (
      "approval_id",
      "parent_id",
      "token_hash",
      "token_expires_at",
      "created_at"
    )
    SELECT
      la."id",
      la."approver_parent_id",
      la."parent_approval_token",
      la."parent_approval_expires_at",
      la."created_at"
    FROM "leave_approvals" la
    WHERE la."approver_parent_id" IS NOT NULL
    ON CONFLICT ("approval_id") DO UPDATE SET
      "parent_id" = EXCLUDED."parent_id",
      "token_hash" = EXCLUDED."token_hash",
      "token_expires_at" = EXCLUDED."token_expires_at";
  `);

  // Step 4: Verification
  console.log("  4/4 Verifying child table data fidelity...");
  const targetResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS target_total,
      COUNT(token_hash)::int AS target_tokens,
      COUNT(token_expires_at)::int AS target_expiries
    FROM "leave_approval_parent_details";
  `);

  const targetRows = ((targetResult as any).rows ?? targetResult) as Array<{
    target_total: number;
    target_tokens: number;
    target_expiries: number;
  }>;

  const target = targetRows[0]!;

  console.log(`      Target total rows: ${target.target_total}`);
  console.log(`      Target tokens: ${target.target_tokens}`);
  console.log(`      Target expiries: ${target.target_expiries}`);

  if (target.target_total !== preflight.source_parent_approvals) {
    throw new Error(
      `Discrepancy detected: Target total (${target.target_total}) does not match source parent approvals (${preflight.source_parent_approvals})`
    );
  }

  // Verify full 1:1 join match
  const mismatchResult = await db.execute(sql`
    SELECT COUNT(*)::int AS mismatches
    FROM "leave_approvals" la
    JOIN "leave_approval_parent_details" lapd ON lapd."approval_id" = la."id"
    WHERE la."approver_parent_id" <> lapd."parent_id"
       OR (la."parent_approval_token" IS DISTINCT FROM lapd."token_hash")
       OR (la."parent_approval_expires_at" IS DISTINCT FROM lapd."token_expires_at");
  `);

  const mismatchRows = ((mismatchResult as any).rows ?? mismatchResult) as Array<{ mismatches: number }>;
  const mismatches = mismatchRows[0]!.mismatches;
  if (mismatches > 0) {
    throw new Error(`Data mismatch detected: ${mismatches} rows differ between parent approvals and parent details!`);
  }

  console.log("Migration 0031 applied and verified with 100% data fidelity!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration 0031 failed:", err);
  process.exit(1);
});
