import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { leaveRequests, students, users, userRoles, roles, notificationRules, notificationTemplates } = await import("@/db");
  const { eq } = await import("drizzle-orm");

  const leave = await db
    .select({
      leaveId: leaveRequests.id,
      status: leaveRequests.status,
      leaveTypeId: leaveRequests.leaveTypeId,
      studentId: leaveRequests.studentId,
    })
    .from(leaveRequests)
    .where(eq(leaveRequests.id, "dd293514-1d95-450e-b6d2-103af9e30128"))
    .limit(1);
  console.log("leave:", JSON.stringify(leave, null, 2));

  const st = await db
    .select({ studentId: students.id, userId: students.userId, hostelId: users.hostelId })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.id, leave[0]!.studentId))
    .limit(1);
  console.log("student:", JSON.stringify(st, null, 2));

  const adminUsers = await db
    .select({ id: users.id, fullName: users.fullName, hostelId: users.hostelId, email: users.email, roleCode: roles.code })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(roles.code, "ADMIN"));
  console.log("ADMIN users:", JSON.stringify(adminUsers, null, 2));

  const rules = await db
    .select({ id: notificationRules.id, eventType: notificationRules.eventType, leaveTypeId: notificationRules.leaveTypeId, templateId: notificationRules.templateId, enabled: notificationRules.enabled })
    .from(notificationRules)
    .where(eq(notificationRules.eventType, "LEAVE_APPROVAL_REQUIRED"));
  console.log("rules:", JSON.stringify(rules, null, 2));

  const templates = await db.select().from(notificationTemplates);
  console.log("templates:", JSON.stringify(templates.map((t) => ({ id: t.id, code: t.code, channel: t.channel, subject: t.subject })), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});