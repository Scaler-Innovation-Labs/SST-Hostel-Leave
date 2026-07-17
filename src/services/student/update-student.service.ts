import { eq } from "drizzle-orm";

import { movementStates, students, users } from "@/db";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import type { UpdateStudentDto } from "@/dto/student/update-student.dto";

export async function updateStudent(id: string, dto: UpdateStudentDto) {
  return transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError("Student");
    }

    const studentFields: Record<string, unknown> = {};
    if (dto.rollNumber !== undefined) studentFields.rollNumber = dto.rollNumber;
    if (dto.academicGroupId !== undefined) studentFields.academicGroupId = dto.academicGroupId;
    if (dto.roomNumber !== undefined) studentFields.roomNumber = dto.roomNumber;

    if (Object.keys(studentFields).length > 0) {
      await tx
        .update(students)
        .set(studentFields)
        .where(eq(students.id, id));
    }

    const userFields: Record<string, unknown> = {};
    if (dto.fullName !== undefined) userFields.fullName = dto.fullName;
    if (dto.email !== undefined) userFields.email = dto.email || null;
    if (dto.phone !== undefined) userFields.phone = dto.phone || null;
    if (dto.gender !== undefined) userFields.gender = dto.gender;
    if (dto.isActive !== undefined) userFields.isActive = dto.isActive;
    if (dto.hostelId !== undefined) userFields.hostelId = dto.hostelId ?? null;

    if (Object.keys(userFields).length > 0) {
      await tx
        .update(users)
        .set(userFields)
        .where(eq(users.id, existing[0]!.userId));
    }

    const rows = await tx
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(movementStates, eq(students.currentLocationState, movementStates.code))
      .where(eq(students.id, id));

    if (rows.length === 0) throw new NotFoundError("Student");

    const row = rows[0]!;
    return {
      student: row.students,
      user: row.users ?? null,
      locationState: row.movement_states ?? null,
    };
  });
}
