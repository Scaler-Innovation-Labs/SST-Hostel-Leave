import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Migration 0028 — recurring late-stay authorization
 *
 * Layer 1 (Authorization): late_stay_authorizations — approved once by
 * POC → ADMIN, versioned, immutable after activation.
 *
 * Layer 2 (Claim): a DB-level partial unique index on leave_requests
 * (metadata->>'authorizationId', metadata->>'occurrenceDate') so exactly one
 * live occurrence exists per authorization per date. The DB arbitrates the
 * race — application-level check-then-insert cannot.
 *
 * Idempotent: every statement is IF NOT EXISTS / guarded, re-running is safe.
 */
async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0028 (recurring late-stay authorization)...");

  // ------------------------------------------------------------------
  // 1. Enum
  // ------------------------------------------------------------------
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "late_stay_auth_status" AS ENUM (
        'PENDING_POC', 'PENDING_ADMIN', 'ACTIVE',
        'REJECTED', 'REVOKED', 'EXPIRED', 'SUPERSEDED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  console.log("  - ensured enum late_stay_auth_status");

  // ------------------------------------------------------------------
  // 1b. audit_action: new actions for the authorization lifecycle
  // ------------------------------------------------------------------
  await db.execute(sql`ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'REVOKE';`);
  await db.execute(sql`ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'EXPIRE';`);
  console.log("  - ensured audit_action values REVOKE, EXPIRE");

  // ------------------------------------------------------------------
  // 1c. notification_event: late-stay authorization lifecycle events
  // ------------------------------------------------------------------
  // ALTER TYPE cannot take the value as a bind parameter — inline literal.
  for (const value of [
    "LATE_STAY_AUTH_SUBMITTED",
    "LATE_STAY_AUTH_STEP_APPROVED",
    "LATE_STAY_AUTH_ACTIVE",
    "LATE_STAY_AUTH_REJECTED",
    "LATE_STAY_AUTH_REVOKED",
    "LATE_STAY_AUTH_EXPIRED",
  ]) {
    if (!/^[A-Z_]+$/.test(value)) throw new Error(`Unsafe enum value: ${value}`);
    await db.execute(sql.raw(`ALTER TYPE "notification_event" ADD VALUE IF NOT EXISTS '${value}';`));
  }
  console.log("  - ensured notification_event values for late-stay authorization lifecycle");

  // ------------------------------------------------------------------
  // 1d. audit_entity_type: LATE_STAY_AUTHORIZATION
  // ------------------------------------------------------------------
  await db.execute(sql`ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'LATE_STAY_AUTHORIZATION';`);
  console.log("  - ensured audit_entity_type value LATE_STAY_AUTHORIZATION");

  // ------------------------------------------------------------------
  // 2. Table late_stay_authorizations
  // ------------------------------------------------------------------
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "late_stay_authorizations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
      "parent_authorization_id" uuid REFERENCES "late_stay_authorizations"("id") ON DELETE RESTRICT,
      "version" integer DEFAULT 1 NOT NULL,
      "valid_from" timestamp with time zone NOT NULL,
      "valid_until" timestamp with time zone NOT NULL,
      "start_time_minutes" integer NOT NULL,
      "end_time_minutes" integer NOT NULL,
      "days_of_week_mask" integer NOT NULL,
      "reason" text NOT NULL,
      "status" "late_stay_auth_status" NOT NULL,
      "poc_approved_at" timestamp with time zone,
      "poc_approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "admin_approved_at" timestamp with time zone,
      "admin_approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "rejected_at" timestamp with time zone,
      "rejected_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "revoke_reason" text,
      "revoked_at" timestamp with time zone,
      "revoked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "lsa_valid_window_chk" CHECK ("valid_from" <= "valid_until"),
      CONSTRAINT "lsa_daily_window_chk" CHECK ("start_time_minutes" < "end_time_minutes"),
      CONSTRAINT "lsa_days_mask_chk" CHECK ("days_of_week_mask" > 0 AND "days_of_week_mask" < 128),
      CONSTRAINT "lsa_version_chk" CHECK ("version" >= 1),
      CONSTRAINT "lsa_parent_chk" CHECK ("parent_authorization_id" IS NULL OR "parent_authorization_id" <> "id")
    );
  `);
  console.log("  - ensured table late_stay_authorizations");

  // ------------------------------------------------------------------
  // 3. Indexes
  // ------------------------------------------------------------------
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "lsa_student_status_idx" ON "late_stay_authorizations" ("student_id", "status");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "lsa_lineage_idx" ON "late_stay_authorizations" ("parent_authorization_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "lsa_status_valid_until_idx" ON "late_stay_authorizations" ("status", "valid_until");`);
  console.log("  - ensured lsa_* indexes");

  // ------------------------------------------------------------------
  // 4. Occurrence idempotency index on leave_requests
  //    ONE live occurrence per (authorizationId, occurrenceDate).
  // ------------------------------------------------------------------
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "lr_recurring_occurrence_unq"
    ON "leave_requests" (
      ("metadata" ->> 'authorizationId'),
      ("metadata" ->> 'occurrenceDate')
    )
    WHERE ("metadata" ->> 'authorizationId') IS NOT NULL
      AND ("status" NOT IN ('CANCELLED', 'REJECTED'));
  `);
  console.log("  - ensured partial unique index lr_recurring_occurrence_unq on leave_requests");

  // ------------------------------------------------------------------
  // 5. Verify
  // ------------------------------------------------------------------
  const enumCheck = await db.execute(sql`
    SELECT 1 FROM pg_type WHERE typname = 'late_stay_auth_status';
  `);
  const tableCheck = await db.execute(sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'late_stay_authorizations';
  `);
  const indexCheck = await db.execute(sql`
    SELECT 1 FROM pg_indexes WHERE indexname = 'lr_recurring_occurrence_unq';
  `);

  if (
    enumCheck.rows.length === 0 ||
    tableCheck.rows.length === 0 ||
    indexCheck.rows.length === 0
  ) {
    throw new Error("Migration 0028 verification failed");
  }

  console.log("Migration 0028 complete.");
}

main().catch((err) => {
  console.error("Migration 0028 failed:", err);
  process.exit(1);
});
