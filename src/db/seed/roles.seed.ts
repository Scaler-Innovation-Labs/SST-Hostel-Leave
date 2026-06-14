import { roles } from "@/db";
import type { db } from "@/lib/db";

export async function seedRoles(
  database: typeof db
) {
  await database
    .insert(roles)
    .values([
      {
        code: "SUPER_ADMIN",
        name: "Super Admin",
      },
      {
        code: "ADMIN",
        name: "Hostel Admin",
      },
      {
        code: "POC",
        name: "Point Of Contact",
      },
      {
        code: "STUDENT",
        name: "Student",
      },
      {
        code: "GUARD",
        name: "Guard",
      },
    ])
    .onConflictDoNothing();
}