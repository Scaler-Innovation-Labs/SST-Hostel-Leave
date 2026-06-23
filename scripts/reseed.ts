import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: ".env.local" });

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping all tables...");
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);

  console.log("Applying migrations...");
  const migrationDir = path.resolve("./src/db/drizzle");
  const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql"));
  for (const file of files.sort()) {
    const sqlContent = fs.readFileSync(path.join(migrationDir, file), "utf8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
    }
    console.log(`  Applied ${file}`);
  }

  console.log("Adding CANCELLED to leave_approval_decision enum...");
  await db.execute(sql.raw(`ALTER TYPE leave_approval_decision ADD VALUE IF NOT EXISTS 'CANCELLED'`));

  console.log("Running seeds...");
  const { seedRoles } = await import("@/db/seed/roles.seed");
  const { seedMovementStates } = await import("@/db/seed/movement-states.seed");
  const { seedDepartments } = await import("@/db/seed/departments.seed");
  const { seedHostels } = await import("@/db/seed/hostels.seed");
  const { seedAcademicGroups } = await import("@/db/seed/academic-groups.seed");
  const { seedWorkflows } = await import("@/db/seed/workflows.seed");
  const { seedLeaveTypes } = await import("@/db/seed/leave-types.seed");
  const { seedPolicies } = await import("@/db/seed/policies.seed");
  const { seedUsers } = await import("@/db/seed/users.seed");
  const { seedStudents } = await import("@/db/seed/students.seed");
  const { seedNotificationTemplates } = await import("@/db/seed/notification-templates.seed");
  const { seedNotificationRules } = await import("@/db/seed/notification-rules.seed");

  await seedRoles(db);
  await seedMovementStates(db);
  await seedDepartments(db);
  await seedHostels(db);
  await seedAcademicGroups(db);
  await seedWorkflows(db);
  await seedLeaveTypes(db);
  await seedPolicies(db);
  await seedUsers(db);
  await seedStudents(db);
  await seedNotificationTemplates();
  await seedNotificationRules();

  console.log("Reseed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit());
