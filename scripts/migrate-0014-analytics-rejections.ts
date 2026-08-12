import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const REJECTION_CATEGORIES = [
  "incomplete",
  "policy_violation",
  "attendance",
  "disciplinary",
  "duplicate",
  "other",
];

async function main() {
  const { db } = await import("@/lib/db");

  const enumRow = (await db.execute(
    sql`SELECT 1 AS x FROM pg_type WHERE typname = ${"leave_rejection_source"}`
  )) as unknown as { x: number }[];

  if (enumRow.length === 0) {
    console.log("Creating leave_rejection_source enum...");
    await db.execute(sql`CREATE TYPE "leave_rejection_source" AS ENUM ('POLICY', 'VALIDATION');`);
  } else {
    console.log("leave_rejection_source enum already exists.");
  }

  console.log("Adding leave_approvals.rejection_category...");
  await db.execute(sql`ALTER TABLE "leave_approvals" ADD COLUMN IF NOT EXISTS "rejection_category" text;`);

  console.log("Backfilling rejection_category from comments prefix...");
  for (const category of REJECTION_CATEGORIES) {
    await db.execute(
      sql`UPDATE "leave_approvals"
          SET "rejection_category" = ${category}
          WHERE "rejection_category" IS NULL
            AND "comments" ILIKE ${"[" + category + "]%"}`
    );
  }

  console.log("Creating leave_rejections table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leave_rejections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
      "leave_request_id" uuid REFERENCES "leave_requests"("id") ON DELETE SET NULL,
      "rejection_source" "leave_rejection_source" NOT NULL,
      "reason" text,
      "restrictions" jsonb,
      "submitted_form" jsonb,
      "start_at" timestamp with time zone NOT NULL,
      "end_at" timestamp with time zone NOT NULL,
      "metadata" jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  console.log("Creating indexes...");
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "leave_rejections_student_id_idx" ON "leave_rejections" ("student_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "leave_rejections_leave_type_id_idx" ON "leave_rejections" ("leave_type_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "leave_rejections_source_idx" ON "leave_rejections" ("rejection_source");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "leave_rejections_created_at_idx" ON "leave_rejections" ("created_at");`);

  console.log("Migration complete.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));