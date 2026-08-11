import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0008...");

  // ── Scoped role assignments ──────────────────────────────────────────
  // user_roles becomes the role-assignment table: a surrogate PK allows a
  // user to hold the same role multiple times with different scopes
  // (e.g. ADMIN over Hostel A and Hostel B), and scope_type/scope_id
  // limit visibility. assigned_by records the assigning user for audit.

  // 1. Drop the old composite PK (user_id, role_id)
  await db.execute(sql`
    ALTER TABLE user_roles
    DROP CONSTRAINT IF EXISTS user_roles_pkey;
  `);
  console.log("  - dropped composite primary key (user_id, role_id)");

  // 2. Add surrogate id and backfill
  await db.execute(sql`
    ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS id uuid;
  `);
  await db.execute(sql`
    UPDATE user_roles SET id = gen_random_uuid() WHERE id IS NULL;
  `);
  await db.execute(sql`
    ALTER TABLE user_roles
    ALTER COLUMN id SET NOT NULL;
  `);
  await db.execute(sql`
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
  `);
  console.log("  - added surrogate id primary key");

  // 3. Scope + audit columns
  await db.execute(sql`
    ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS scope_type text;
  `);
  await db.execute(sql`
    ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS scope_id uuid;
  `);
  await db.execute(sql`
    ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS assigned_by uuid
    REFERENCES users(id) ON DELETE SET NULL;
  `);
  console.log("  - added scope_type, scope_id, assigned_by columns");

  // 4. Unique per (user, role, scope) — null scope = unrestricted
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_scope_unq
    ON user_roles (user_id, role_id, scope_type, scope_id);
  `);
  console.log("  - added unique index (user_id, role_id, scope_type, scope_id)");

  console.log("Migration 0008 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
