/**
 * Clears all data from the database and reseeds fresh.
 *
 * Usage:
 *   npx tsx scripts/clear-and-seed.ts
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");

  console.log("Clearing all data...");

  await db.execute(sql`
    TRUNCATE TABLE
      audit_logs,
      sheet_sync_logs,
      inbound_sms_logs,
      notification_logs,
      notification_rule_recipients,
      notification_rule_channels,
      notification_rules,
      notification_templates,
      qr_scan_logs,
      movement_events,
      qr_passes,
      leave_documents,
      leave_approvals,
      leave_extensions,
      leave_requests,
      leave_types,
      operational_periods,
      policies,
      parent_otp_sessions,
      parents,
      user_roles,
      students,
      academic_groups,
      departments,
      hostels,
      users,
      roles,
      workflow_steps,
      workflow_definitions,
      outbox_events,
      movement_states
    CASCADE
  `);

  console.log("All data cleared.\n");

  console.log("Seeding fresh data...\n");
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
  const { seedNotificationTemplates } = await import(
    "@/db/seed/notification-templates.seed"
  );
  const { seedNotificationRules } = await import(
    "@/db/seed/notification-rules.seed"
  );

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

  console.log("\nSeed complete.");
}

main()
  .then(() => {
    console.log("\nAll done — data cleared and reseeded.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFailed:", error);
    process.exit(1);
  });
