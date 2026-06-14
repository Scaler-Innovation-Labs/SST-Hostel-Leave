import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0007...");

  // Drop raw_token column — tokens should never be stored in the database
  await db.execute(sql`
    ALTER TABLE qr_passes
    DROP COLUMN IF EXISTS raw_token;
  `);
  console.log("  - raw_token column dropped from qr_passes");

  // Drop old unique constraint on leave_request_id alone
  // The new unique constraint is (leave_request_id, qr_type) for exit + return passes
  await db.execute(sql`
    DROP INDEX IF EXISTS qr_passes_leave_request_id_key;
  `);
  console.log("  - old unique index on leave_request_id dropped (replaced by composite unique)");

  // Drop old unique constraint by name if it exists as a constraint
  await db.execute(sql`
    ALTER TABLE qr_passes
    DROP CONSTRAINT IF EXISTS qr_passes_leave_request_id_key;
  `);
  console.log("  - old unique constraint on leave_request_id dropped");

  // Add composite unique constraint for (leave_request_id, qr_type)
  // Allows one EXIT and one RETURN pass per leave
  await db.execute(sql`
    ALTER TABLE qr_passes
    ADD CONSTRAINT qr_pass_leave_request_qr_type_unq
    UNIQUE (leave_request_id, qr_type);
  `);
  console.log("  - composite unique constraint (leave_request_id, qr_type) added");

  console.log("Migration 0007 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
