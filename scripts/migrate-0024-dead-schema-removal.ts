import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0024 (config versioning + schema cleanup)...");

  // ============================================================
  // 1. Immutable configuration version tables
  // ============================================================
  // leave_type_versions / workflow_versions / policy_versions hold one row
  // per actual configuration change. leave_configuration_contexts points
  // each leave at the exact versions it was created under; policy_evaluations
  // records what each policy decided for that leave, including the input
  // values the decision was computed from.

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "workflow_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "workflow_definition_id" uuid NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT,
      "version" integer NOT NULL,
      "code" text NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "steps" jsonb NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "workflow_version_unq" UNIQUE ("workflow_definition_id", "version")
    );
    CREATE INDEX IF NOT EXISTS "wv_workflow_definition_id_idx" ON "workflow_versions" ("workflow_definition_id");
    CREATE INDEX IF NOT EXISTS "wv_created_at_idx" ON "workflow_versions" ("created_at");
  `);
  console.log("  - created workflow_versions");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "policy_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE RESTRICT,
      "version" integer NOT NULL,
      "name" text NOT NULL,
      "policy_type" "policy_type" NOT NULL,
      "priority" integer DEFAULT 0 NOT NULL,
      "leave_type_id" uuid REFERENCES "leave_types"("id") ON DELETE SET NULL,
      "hostel_id" uuid REFERENCES "hostels"("id") ON DELETE SET NULL,
      "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL,
      "batch_year" integer,
      "config" jsonb NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "starts_at" timestamp with time zone,
      "ends_at" timestamp with time zone,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "policy_version_unq" UNIQUE ("policy_id", "version")
    );
    CREATE INDEX IF NOT EXISTS "pov_policy_id_idx" ON "policy_versions" ("policy_id");
    CREATE INDEX IF NOT EXISTS "pov_leave_type_id_idx" ON "policy_versions" ("leave_type_id");
    CREATE INDEX IF NOT EXISTS "pov_hostel_id_idx" ON "policy_versions" ("hostel_id");
  `);
  console.log("  - created policy_versions");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leave_type_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id") ON DELETE RESTRICT,
      "version" integer NOT NULL,
      "code" text NOT NULL,
      "name" text NOT NULL,
      "category" "leave_category" NOT NULL,
      "description" text,
      "form_schema" jsonb NOT NULL,
      "qr_mode" "qr_mode" DEFAULT 'BOTH' NOT NULL,
      "policy_config" jsonb,
      "notification_config" jsonb,
      "use_global_notification_rules" boolean DEFAULT true NOT NULL,
      "required_documents" jsonb,
      "ui_config" jsonb,
      "workflow_mode" "workflow_mode" NOT NULL,
      "allow_extensions" boolean DEFAULT false NOT NULL,
      "max_extension_count" integer,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "leave_type_version_unq" UNIQUE ("leave_type_id", "version")
    );
    CREATE INDEX IF NOT EXISTS "ltv_leave_type_id_idx" ON "leave_type_versions" ("leave_type_id");
    CREATE INDEX IF NOT EXISTS "ltv_created_at_idx" ON "leave_type_versions" ("created_at");
  `);
  console.log("  - created leave_type_versions");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leave_configuration_contexts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "leave_request_id" uuid NOT NULL UNIQUE REFERENCES "leave_requests"("id") ON DELETE CASCADE,
      "leave_type_version_id" uuid NOT NULL REFERENCES "leave_type_versions"("id") ON DELETE RESTRICT,
      "workflow_version_id" uuid NOT NULL REFERENCES "workflow_versions"("id") ON DELETE RESTRICT,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "lcc_leave_type_version_id_idx" ON "leave_configuration_contexts" ("leave_type_version_id");
    CREATE INDEX IF NOT EXISTS "lcc_workflow_version_id_idx" ON "leave_configuration_contexts" ("workflow_version_id");
  `);
  console.log("  - created leave_configuration_contexts");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "policy_evaluations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "leave_request_id" uuid NOT NULL REFERENCES "leave_requests"("id") ON DELETE CASCADE,
      "policy_id" uuid REFERENCES "policies"("id") ON DELETE SET NULL,
      "policy_version_id" uuid REFERENCES "policy_versions"("id") ON DELETE RESTRICT,
      "config" jsonb,
      "passed" boolean NOT NULL,
      "message" text,
      "evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "pe_leave_request_id_idx" ON "policy_evaluations" ("leave_request_id");
    CREATE INDEX IF NOT EXISTS "pe_policy_version_id_idx" ON "policy_evaluations" ("policy_version_id");
  `);
  console.log("  - created policy_evaluations");

  // ============================================================
  // 2. Backfill v1 versions from the current configuration
  // ============================================================

  await db.execute(sql`
    INSERT INTO "workflow_versions" (
      "id", "workflow_definition_id", "version", "code", "name", "description",
      "is_active", "steps", "created_by", "created_at"
    )
    SELECT
      gen_random_uuid(), wd."id", 1, wd."code", wd."name", wd."description",
      wd."is_active",
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'stepKey', ws."step_key",
            'stepOrder', ws."step_order",
            'approverRoleCode', r."code",
            'isParentApproval', ws."is_parent_approval",
            'approvalMethod', ws."approval_method",
            'isRequired', ws."is_required"
          )
          ORDER BY ws."step_order"
        ) FILTER (WHERE ws."id" IS NOT NULL),
        '[]'::jsonb
      ),
      NULL, now()
    FROM "workflow_definitions" wd
    LEFT JOIN "workflow_steps" ws ON ws."workflow_definition_id" = wd."id"
    LEFT JOIN "roles" r ON r."id" = ws."approver_role_id"
    GROUP BY wd."id"
    ON CONFLICT ("workflow_definition_id", "version") DO NOTHING;
  `);
  console.log("  - backfilled workflow_versions v1");

  await db.execute(sql`
    INSERT INTO "policy_versions" (
      "id", "policy_id", "version", "name", "policy_type", "priority",
      "leave_type_id", "hostel_id", "department_id", "batch_year", "config",
      "is_active", "starts_at", "ends_at", "created_by", "created_at"
    )
    SELECT
      gen_random_uuid(), p."id", 1, p."name", p."policy_type", p."priority",
      p."leave_type_id", p."hostel_id", p."department_id", p."batch_year",
      p."config", p."is_active", p."starts_at", p."ends_at", NULL, now()
    FROM "policies" p
    ON CONFLICT ("policy_id", "version") DO NOTHING;
  `);
  console.log("  - backfilled policy_versions v1");

  await db.execute(sql`
    INSERT INTO "leave_type_versions" (
      "id", "leave_type_id", "version", "code", "name", "category", "description",
      "form_schema", "qr_mode", "policy_config", "notification_config",
      "use_global_notification_rules", "required_documents", "ui_config",
      "workflow_mode", "allow_extensions", "max_extension_count",
      "created_by", "created_at"
    )
    SELECT
      gen_random_uuid(), lt."id", 1, lt."code", lt."name", lt."category",
      lt."description", lt."form_schema", lt."qr_mode", lt."policy_config",
      lt."notification_config", lt."use_global_notification_rules",
      lt."required_documents", lt."ui_config", lt."workflow_mode",
      lt."allow_extensions", lt."max_extension_count", NULL, now()
    FROM "leave_types" lt
    ON CONFLICT ("leave_type_id", "version") DO NOTHING;
  `);
  console.log("  - backfilled leave_type_versions v1");

  // Point every existing leave at the v1 versions of its type + workflow,
  // so legacy leaves are explainable too.
  await db.execute(sql`
    INSERT INTO "leave_configuration_contexts" (
      "id", "leave_request_id", "leave_type_version_id", "workflow_version_id", "created_at"
    )
    SELECT
      gen_random_uuid(), lr."id", ltv."id", wv."id", lr."created_at"
    FROM "leave_requests" lr
    JOIN "leave_types" lt ON lt."id" = lr."leave_type_id"
    JOIN "leave_type_versions" ltv ON ltv."leave_type_id" = lt."id" AND ltv."version" = 1
    LEFT JOIN "workflow_versions" wv
      ON wv."workflow_definition_id" = lt."default_workflow_id" AND wv."version" = 1
    WHERE NOT EXISTS (
      SELECT 1 FROM "leave_configuration_contexts" lcc WHERE lcc."leave_request_id" = lr."id"
    );
  `);
  console.log("  - backfilled leave_configuration_contexts");

  // Reconstruct per-policy evaluation rows from the stored aggregate result,
  // ONLY when the check carries an unambiguous policy id that still resolves
  // to a version. checks[].key is the policy uuid the engine evaluated (see
  // policy-engine.ts). If the policy was deleted, or the key is not a uuid,
  // the row is NOT guessed: the aggregate policy_result stays the historical
  // fact and policy_evaluations stays empty for that leave.
  await db.execute(sql`
    INSERT INTO "policy_evaluations" (
      "id", "leave_request_id", "policy_id", "policy_version_id", "passed", "message", "evaluated_at"
    )
    SELECT
      gen_random_uuid(), lr."id", pv."policy_id", pv."id",
      c."passed", c."message", lr."created_at"
    FROM "leave_requests" lr
    CROSS JOIN LATERAL (
      SELECT
        elem ->> 'key' AS check_key,
        (elem ->> 'passed')::boolean AS passed,
        elem ->> 'message' AS message
      FROM jsonb_array_elements(lr."policy_result"->'checks') AS elem
    ) AS c
    INNER JOIN "policy_versions" pv
      ON pv."policy_id" = (
        CASE WHEN c."check_key" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN c."check_key"::uuid
        END
      )
      AND pv."version" = 1
    WHERE lr."policy_result" IS NOT NULL
      AND c."check_key" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT EXISTS (
        SELECT 1 FROM "policy_evaluations" pe WHERE pe."leave_request_id" = lr."id"
      );
  `);
  console.log("  - backfilled policy_evaluations from unambiguous policy_result checks");

  // ============================================================
  // 3. Notification log CC canonicalization
  // ============================================================
  // notification_logs.cc_recipients is the canonical column; any historical
  // rows that stored CCs inside metadata are moved over where possible.
  await db.execute(sql`
    UPDATE "notification_logs"
    SET "cc_recipients" = "metadata"->'ccRecipients',
        "metadata" = "metadata" - 'ccRecipients'
    WHERE "cc_recipients" IS NULL
      AND "metadata" ? 'ccRecipients';
  `);
  console.log("  - backfilled notification_logs.cc_recipients from metadata");

  // ============================================================
  // 4. Dead tables (never written or read by any code path)
  // ============================================================
  // inbound_sms_logs / sheet_sync_logs: designed for parent SMS-reply and
  // Google Sheets sync features that were never built (no webhook route,
  // no repository, no service, no integration exists).
  // parent_otp_sessions: abandoned parent-OTP design recreated by
  // migrate-0004; superseded by tokenized approval links on leave_approvals.
  await db.execute(sql`
    DROP TABLE IF EXISTS "inbound_sms_logs";
    DROP TABLE IF EXISTS "sheet_sync_logs";
    DROP TABLE IF EXISTS "parent_otp_sessions";
  `);
  console.log("  - dropped inbound_sms_logs, sheet_sync_logs, parent_otp_sessions");

  // ---- Orphaned enum types (consumed only by the dropped tables) ----
  await db.execute(sql`
    DROP TYPE IF EXISTS "sms_parsed_action";
    DROP TYPE IF EXISTS "sms_processing_status";
    DROP TYPE IF EXISTS "sheet_sync_status";
  `);
  console.log("  - dropped orphaned enums (sms_parsed_action, sms_processing_status, sheet_sync_status)");

  // ============================================================
  // 5. Unused columns
  // ============================================================
  // Version/snapshot columns replaced by the version tables + configuration
  // context. request_version had no concurrency mechanism behind it.
  // leave_extensions metadata is KEPT (audit/extension slot, consistent with
  // the rest of the system); only the snapshot copy goes away.
  await db.execute(sql`
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "request_version";
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "leave_type_version";
    ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "approval_snapshot";
    ALTER TABLE "leave_extensions" DROP COLUMN IF EXISTS "approval_snapshot";
  `);
  console.log("  - dropped leave_requests.request_version, leave_requests.leave_type_version, approval_snapshot columns");

  // OTP columns: tokenized parent approval links superseded the OTP design.
  await db.execute(sql`
    ALTER TABLE "leave_approvals" DROP COLUMN IF EXISTS "parent_approval_otp_hash";
    ALTER TABLE "leave_approvals" DROP COLUMN IF EXISTS "parent_approval_verified_at";
  `);
  console.log("  - dropped leave_approvals OTP columns");

  // ============================================================
  // 6. Kept-but-restored columns
  // ============================================================
  // users.last_login_at is KEPT and now actively written by get-current-user
  // (login audit, inactive-user detection). Ensure the column exists in case
  // an earlier migration draft dropped it.
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
  `);
  console.log("  - ensured users.last_login_at exists (kept + now written)");

  console.log("Migration 0024 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));