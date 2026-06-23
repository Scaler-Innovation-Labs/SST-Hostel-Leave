import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

import { seedAcademicGroups } from "./academic-groups.seed";
import { seedDepartments } from "./departments.seed";
import { seedHostels } from "./hostels.seed";
import { seedLeaveTypes } from "./leave-types.seed";
import { seedMovementStates } from "./movement-states.seed";
import { seedNotificationRules } from "./notification-rules.seed";
import { seedNotificationTemplates } from "./notification-templates.seed";
import { seedPolicies } from "./policies.seed";
import { seedRoles } from "./roles.seed";
import { seedStudents } from "./students.seed";
import { seedUsers } from "./users.seed";
import { seedWorkflows } from "./workflows.seed";

async function main() {
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

  logger.info("Seed complete");
}

main()
  .catch((error) => { logger.error("Seed failed", { error: error instanceof Error ? error.message : String(error) }); })
  .finally(() => process.exit());