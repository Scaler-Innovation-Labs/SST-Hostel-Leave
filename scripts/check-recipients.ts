import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const STUDENT_ID = "66185236-f090-4bfc-8d4b-ac8f9227a572";

async function main() {
  const { db } = await import("@/lib/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { students, users, roles, userRoles, hostels } = await import("@/db");

  const student = await db.select().from(students).where(eq(students.id, STUDENT_ID));
  console.log("═══ STUDENT ═══");
  console.log(JSON.stringify(student, null, 2));

  const user = student[0] ? await db.select().from(users).where(eq(users.id, student[0].userId)) : [];
  console.log("\n═══ USER ═══");
  if (user[0]) {
    const { email, phone, hostelId, id, fullName } = user[0];
    console.log(JSON.stringify({ id, fullName, email, phone, hostelId }, null, 2));
  } else {
    console.log("NO USER FOUND");
  }

  const hostelId = user[0]?.hostelId;
  if (hostelId) {
    const h = await db.select().from(hostels).where(eq(hostels.id, hostelId));
    console.log("\n═══ HOSTEL (slack config) ═══");
    console.log(JSON.stringify(h.map((x) => ({ id: x.id, name: x.name, slackChannelId: x.slackChannelId, slackAdminGroupId: x.slackAdminGroupId })), null, 2));
  }

  const pocRole = await db.select().from(roles).where(eq(roles.code, "POC"));
  console.log("\n═══ POC ROLE ═══");
  console.log(JSON.stringify(pocRole, null, 2));

  if (pocRole[0]) {
    const pocAssignments = await db
      .select({ userId: userRoles.userId, scopeType: userRoles.scopeType, scopeId: userRoles.scopeId })
      .from(userRoles)
      .where(eq(userRoles.roleId, pocRole[0].id));
    console.log("\n═══ POC ASSIGNMENTS ═══");
    console.log(JSON.stringify(pocAssignments, null, 2));

    const pocUserIds = pocAssignments.map((a) => a.userId);
    const pocUsers = await db
      .select({ id: users.id, fullName: users.fullName, hostelId: users.hostelId, email: users.email })
      .from(users)
      .where(inArray(users.id, pocUserIds));
    console.log("\n═══ POC USERS (id, hostelId) ═══");
    console.log(JSON.stringify(pocUsers, null, 2));

    if (hostelId) {
      const matching = pocUsers.filter((u) => u.hostelId === hostelId);
      console.log(`\nPOC users with hostelId === student hostel (${hostelId}): ${matching.length}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });