import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0021 (performance indexes)...");

  const statements: Array<[string, string]> = [
    [
      "qr_scan_logs_scanned_at_idx",
      "CREATE INDEX IF NOT EXISTS qr_scan_logs_scanned_at_idx ON qr_scan_logs (scanned_at);",
    ],
    [
      "la_created_at_idx",
      "CREATE INDEX IF NOT EXISTS la_created_at_idx ON leave_approvals (created_at);",
    ],
    [
      "la_acted_at_idx",
      "CREATE INDEX IF NOT EXISTS la_acted_at_idx ON leave_approvals (acted_at);",
    ],
    [
      "notification_logs_created_at_idx",
      "CREATE INDEX IF NOT EXISTS notification_logs_created_at_idx ON notification_logs (created_at);",
    ],
    [
      "user_roles_role_id_idx",
      "CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles (role_id);",
    ],
  ];

  for (const [name, statement] of statements) {
    await db.execute(sql`${sql.raw(statement)}`);
    console.log(`  - created index ${name}`);
  }

  console.log("Migration 0021 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));