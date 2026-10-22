/**
 * Migration 0032: Drop legacy parent approval columns from leave_approvals.
 *
 * Preconditions verified in transaction:
 *   1. All leave_approvals rows where approver_parent_id IS NOT NULL have an exact,
 *      matching row in leave_approval_parent_details.
 *   2. No data divergence exists between the legacy columns and the child table.
 *
 * If invariants fail, the transaction rolls back cleanly without dropping anything.
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import pg from "pg";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("=== Migration 0032: Drop Legacy Parent Columns ===");
    await client.query("BEGIN;");

    // 1. Invariant check: Verify all legacy parent approvals exist identically in child table
    const checkQuery = `
      SELECT
        COUNT(*)::int AS legacy_parent_count,
        COUNT(lapd.approval_id)::int AS matched_in_child,
        COUNT(*) FILTER (
          WHERE la.approver_parent_id <> lapd.parent_id
             OR la.parent_approval_token IS DISTINCT FROM lapd.token_hash
             OR la.parent_approval_expires_at IS DISTINCT FROM lapd.token_expires_at
        )::int AS mismatched_rows
      FROM leave_approvals la
      LEFT JOIN leave_approval_parent_details lapd ON la.id = lapd.approval_id
      WHERE la.approver_parent_id IS NOT NULL;
    `;

    const { rows } = await client.query(checkQuery);
    const { legacy_parent_count, matched_in_child, mismatched_rows } = rows[0];

    console.log(`Preflight Invariant Check:`);
    console.log(`  - Legacy parent approval rows: ${legacy_parent_count}`);
    console.log(`  - Matched in child table:      ${matched_in_child}`);
    console.log(`  - Mismatched rows:             ${mismatched_rows}`);

    if (legacy_parent_count !== matched_in_child) {
      throw new Error(
        `Preflight failed: legacy count (${legacy_parent_count}) does not match child count (${matched_in_child})`
      );
    }

    if (mismatched_rows > 0) {
      throw new Error(`Preflight failed: found ${mismatched_rows} mismatched rows between parent and child table`);
    }

    console.log("✅ Invariant verified: 100% of legacy rows are faithfully persisted in leave_approval_parent_details.");

    // 2. Drop constraints and indexes on legacy columns
    console.log("Dropping legacy constraints and indexes...");

    await client.query(`
      ALTER TABLE leave_approvals
        DROP CONSTRAINT IF EXISTS leave_approvals_approver_parent_id_parents_id_fk;
    `);

    await client.query(`
      ALTER TABLE leave_approvals
        DROP CONSTRAINT IF EXISTS leave_approvals_parent_approval_token_unique;
    `);

    await client.query(`
      DROP INDEX IF EXISTS la_parent_token_idx;
      DROP INDEX IF EXISTS la_approver_parent_id_idx;
      DROP INDEX IF EXISTS la_parent_expiry_idx;
      DROP INDEX IF EXISTS la_parent_decision_created_idx;
    `);

    // 3. Drop legacy columns
    console.log("Dropping columns approver_parent_id, parent_approval_token, parent_approval_expires_at...");

    await client.query(`
      ALTER TABLE leave_approvals
        DROP COLUMN IF EXISTS approver_parent_id,
        DROP COLUMN IF EXISTS parent_approval_token,
        DROP COLUMN IF EXISTS parent_approval_expires_at;
    `);

    await client.query("COMMIT;");
    console.log("✅ Migration 0032 completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("❌ Migration 0032 rolled back due to error:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
