import { eq } from "drizzle-orm";

import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { roles, students, userRoles, users } from "@/db";
import { ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";

type BulkStudentRow = {
  fullName: string;
  email?: string;
  phone?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  rollNumber: string;
  academicGroupId: string;
  roomNumber?: string | null;
  hostelId?: string | null;
};

export async function bulkCreateStudents(rows: BulkStudentRow[]): Promise<{ rollNumber: string; success: boolean; error?: string }[]> {
  const results: { rollNumber: string; success: boolean; error?: string }[] = [];

  const [roleRow] = await db
    .select()
    .from(roles)
    .where(eq(roles.code, ROLES.STUDENT))
    .limit(1);

  for (const row of rows) {
    try {
      const existing = await db
        .select()
        .from(students)
        .where(eq(students.rollNumber, row.rollNumber))
        .limit(1);

      if (existing.length > 0) {
        results.push({ rollNumber: row.rollNumber, success: false, error: "Roll number already exists" });
        continue;
      }

      const userRows = await db
        .insert(users)
        .values({
          fullName: row.fullName,
          email: row.email || null,
          phone: row.phone || null,
          gender: row.gender ?? null,
          hostelId: row.hostelId ?? null,
        })
        .returning();

      if (!userRows[0]) {
        results.push({ rollNumber: row.rollNumber, success: false, error: "Failed to create user" });
        continue;
      }

      const user = userRows[0];

      await db
        .insert(students)
        .values({
          userId: user.id,
          rollNumber: row.rollNumber,
          academicGroupId: row.academicGroupId,
          roomNumber: row.roomNumber ?? null,
          currentLocationState: MOVEMENT_STATE.IN_HOSTEL,
        })
        .returning();

      if (roleRow) {
        await db
          .insert(userRoles)
          .values({ userId: user.id, roleId: roleRow.id })
          .onConflictDoNothing();
      }

      results.push({ rollNumber: row.rollNumber, success: true });
    } catch (err) {
      results.push({
        rollNumber: row.rollNumber,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
