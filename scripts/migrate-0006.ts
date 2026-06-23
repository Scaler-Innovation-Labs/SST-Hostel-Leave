import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0006...");

  await db.execute(sql`
    ALTER TABLE policies
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;
  `);
  console.log("  - department_id column added to policies");

  await db.execute(sql`
    ALTER TABLE policies
    ADD COLUMN IF NOT EXISTS batch_year integer;
  `);
  console.log("  - batch_year column added to policies");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS policies_department_id_idx
    ON policies (department_id);
  `);
  console.log("  - department_id index created");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS policies_batch_year_idx
    ON policies (batch_year);
  `);
  console.log("  - batch_year index created");

  console.log("Migration 0006 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
