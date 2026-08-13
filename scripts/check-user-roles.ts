import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const USER_ID = "f9d0f65b-3a2b-4387-b902-11305f4c8d9c";

async function main() {
  const { db } = await import("@/lib/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { users, userRoles, roles, hostels } = await import("@/db");

  const user = await db.select().from(users).where(eq(users.id, USER_ID));
  console.log("═══ USER ═══");
  console.log(JSON.stringify(user.map(({ id, fullName, email, hostelId }) => ({ id, fullName, email, hostelId })), null, 2));

  const assignments = await db
    .select({
      userId: userRoles.userId,
      roleId: userRoles.roleId,
      scopeType: userRoles.scopeType,
      scopeId: userRoles.scopeId,
      assignedBy: userRoles.assignedBy,
      assignedAt: userRoles.assignedAt,
    })
    .from(userRoles)
    .where(eq(userRoles.userId, USER_ID));
  console.log("\n═══ USER_ROLES ROWS ═══");
  console.log(JSON.stringify(assignments, null, 2));

  const roleIds = [...new Set(assignments.map((a) => a.roleId))];
  if (roleIds.length) {
    const roleRows = await db
      .select()
      .from(roles)
      .where(inArray(roles.id, roleIds));
    console.log("\n═══ ROLES ═══");
    console.log(JSON.stringify(roleRows, null, 2));
  }

  const scopeIds = [...new Set(assignments.map((a) => a.scopeId).filter(Boolean))] as string[];
  if (scopeIds.length) {
    const hs = await db
      .select({ id: hostels.id, name: hostels.name })
      .from(hostels)
      .where(inArray(hostels.id, scopeIds));
    console.log("\n═══ HOSTELS (by scopeId) ═══");
    console.log(JSON.stringify(hs, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });