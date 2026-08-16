import { roles } from "@/db";
import { ROLES } from "@/lib/auth/roles";
import type { db } from "@/lib/db";

export async function seedRoles(
  database: typeof db
) {
  await database
    .insert(roles)
    .values([
      {
        code: ROLES.SUPER_ADMIN,
        name: "Super Admin",
      },
      {
        code: ROLES.ADMIN,
        name: "Hostel Admin",
      },
      {
        code: ROLES.POC,
        name: "Point Of Contact",
      },
      {
        code: ROLES.STUDENT,
        name: "Student",
      },
      {
        code: ROLES.GUARD,
        name: "Guard",
      },
    ])
    .onConflictDoNothing();
}