import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.worker") });

// Migration 0030: Core Database Integrity Hardening
// 1. Approval step uniqueness (per leave request and per extension)
// 2. Exactly one primary parent per student
// 3. User roles scope consistency CHECK constraint & partial unique indexes
// 4. Leave requests temporal date checks
// 5. Leave questions index on leave_request_id

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0030 (core database integrity hardening)...");

  // 1. Leave approvals step uniqueness
  console.log("  1/5 Creating partial unique indexes for approval steps...");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "leave_approvals_request_step_unq"
    ON "leave_approvals" ("leave_request_id", "step_order")
    WHERE "leave_request_id" IS NOT NULL;
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "leave_approvals_extension_step_unq"
    ON "leave_approvals" ("leave_extension_id", "step_order")
    WHERE "leave_extension_id" IS NOT NULL;
  `);

  // 2. One primary parent per student
  console.log("  2/5 Creating partial unique index for primary parent...");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "parents_one_primary_per_student"
    ON "parents" ("student_id")
    WHERE "is_primary" = true;
  `);

  // 3. User roles scope consistency & uniqueness
  console.log("  3/5 Applying user_roles scope check constraint and partial unique indexes...");
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_scope_consistency_chk'
      ) THEN
        ALTER TABLE "user_roles"
        ADD CONSTRAINT "user_roles_scope_consistency_chk"
        CHECK (
          (scope_type IS NULL AND scope_id IS NULL)
          OR
          (scope_type IS NOT NULL AND scope_id IS NOT NULL)
        );
      END IF;
    END $$;
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_unrestricted_unq"
    ON "user_roles" ("user_id", "role_id")
    WHERE "scope_type" IS NULL;
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_scoped_unq"
    ON "user_roles" ("user_id", "role_id", "scope_type", "scope_id")
    WHERE "scope_type" IS NOT NULL;
  `);

  // 4. Leave requests temporal date checks
  console.log("  4/5 Applying leave_requests temporal check constraints...");
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_dates_valid_chk'
      ) THEN
        ALTER TABLE "leave_requests"
        ADD CONSTRAINT "leave_requests_dates_valid_chk"
        CHECK ("end_at" >= "start_at");
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_actual_return_valid_chk'
      ) THEN
        ALTER TABLE "leave_requests"
        ADD CONSTRAINT "leave_requests_actual_return_valid_chk"
        CHECK ("actual_return_at" IS NULL OR "actual_return_at" >= "start_at");
      END IF;
    END $$;
  `);

  // 5. Leave questions index
  console.log("  5/5 Creating index on leave_questions(leave_request_id)...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "leave_questions_leave_request_id_idx"
    ON "leave_questions" ("leave_request_id");
  `);

  console.log("Migration 0030 completed successfully.");
}

main()
  .catch((error) => {
    console.error("Migration 0030 failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
