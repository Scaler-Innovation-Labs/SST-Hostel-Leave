import { eq, inArray } from "drizzle-orm";

import { hostels, roles, userRoles, users } from "@/db";
import type { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function seedUsers(
  database: typeof db
) {
  const roleRows = await database
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(inArray(roles.code, ["SUPER_ADMIN", "ADMIN", "POC", "STUDENT", "GUARD"]));

  const roleMap = Object.fromEntries(
    roleRows.map((r) => [r.code, r.id])
  );

  const hostelRows = await database
    .select({ id: hostels.id, code: hostels.code })
    .from(hostels)
    .where(inArray(hostels.code, ["UNI-1"]));

  const hostelId = hostelRows.length > 0 ? hostelRows[0]!.id : undefined;

  const userValues = [
    {
      fullName: "Super Admin",
      email: "n.vedvarshit@gmail.com",
      phone: "9999999990",
      isActive: true,
    },
    {
      fullName: "Hostel Admin",
      email: "vedavarshitn@gmail.com",
      phone: "9999999991",
      hostelId,
      isActive: true,
    },
    {
      fullName: "Test Student",
      email: "neerasa.24bcs10005@sst.scaler.com",
      phone: "9391541081",
      hostelId,
      isActive: true,
    },
  ];

  const insertedUsers = await database
    .insert(users)
    .values(userValues)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email });

  const userMap: Record<string, string> = {};
  for (const u of insertedUsers) {
    if (u.email) {
      userMap[u.email] = u.id;
    }
  }

  for (const email of ["n.vedvarshit@gmail.com", "vedavarshitn@gmail.com", "neerasa.24bcs10005@sst.scaler.com"]) {
    if (!userMap[email]) {
      const existing = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing.length > 0) {
        userMap[email] = existing[0]!.id;
      }
    }
  }

  const assignments: { email: string; roleCode: string }[] = [
    { email: "n.vedvarshit@gmail.com", roleCode: "SUPER_ADMIN" },
    { email: "vedavarshitn@gmail.com", roleCode: "ADMIN" },
    { email: "vedavarshitn@gmail.com", roleCode: "POC" },
    { email: "neerasa.24bcs10005@sst.scaler.com", roleCode: "STUDENT" },
    { email: "vedavarshitn@gmail.com", roleCode: "GUARD" },
  ];

  for (const { email, roleCode } of assignments) {
    const userId = userMap[email];
    const roleId = roleMap[roleCode];
    if (!userId || !roleId) {
      logger.warn("Skipping user_role", { email, roleCode });
      continue;
    }
    await database
      .insert(userRoles)
      .values({ userId, roleId })
      .onConflictDoNothing();
  }
}
