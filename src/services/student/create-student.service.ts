import { eq } from "drizzle-orm";

import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { roles, students, userRoles, users } from "@/db";
import { ROLES } from "@/lib/auth/roles";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import type { CreateStudentDto } from "@/dto/student/create-student.dto";

export async function createStudent(dto: CreateStudentDto) {
  return transaction(async (tx) => {
    const existingRoll = await tx
      .select()
      .from(students)
      .where(eq(students.rollNumber, dto.rollNumber))
      .limit(1);

    if (existingRoll.length > 0) {
      throw new ConflictError("Roll number already exists");
    }

    const [roleRow] = await tx
      .select()
      .from(roles)
      .where(eq(roles.code, ROLES.STUDENT))
      .limit(1);

    const userRows = await tx
      .insert(users)
      .values({
        fullName: dto.fullName,
        email: dto.email || null,
        phone: dto.phone || null,
        gender: dto.gender ?? null,
        hostelId: dto.hostelId ?? null,
      })
      .returning();

    if (!userRows[0]) throw new Error("Failed to create user");
    const user = userRows[0];

    const [student] = await tx
      .insert(students)
      .values({
        userId: user.id,
        rollNumber: dto.rollNumber,
        academicGroupId: dto.academicGroupId,
        roomNumber: dto.roomNumber ?? null,
        currentLocationState: MOVEMENT_STATE.IN_HOSTEL,
      })
      .returning();

    if (roleRow) {
      await tx
        .insert(userRoles)
        .values({ userId: user.id, roleId: roleRow.id })
        .onConflictDoNothing();
    }

    return student;
  });
}
