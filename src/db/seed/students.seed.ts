import { eq } from "drizzle-orm";

import { academicGroups, parents, students, users } from "@/db";
import type { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function seedStudents(
  database: typeof db
) {
  const userRows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "neerasa.24bcs10005@sst.scaler.com"))
    .limit(1);

  if (userRows.length === 0) {
    logger.warn("Student user not found, skipping student seed");
    return;
  }

  const groupRows = await database
    .select({ id: academicGroups.id })
    .from(academicGroups)
    .limit(1);

  if (groupRows.length === 0) {
    logger.warn("No academic groups found, skipping student seed");
    return;
  }

  const userId = userRows[0]!.id;
  const groupId = groupRows[0]!.id;

  const studentRows = await database
    .insert(students)
    .values({
      userId,
      academicGroupId: groupId,
      rollNumber: "24BCS10005",
      roomNumber: "101",
      currentLocationState: "IN_HOSTEL",
    })
    .onConflictDoNothing({ target: students.rollNumber })
    .returning({ id: students.id });

  let studentId: string;

  if (studentRows.length === 0) {
    // Student already exists – find their id to ensure parent is linked
    const existing = await database
      .select({ id: students.id })
      .from(students)
      .where(eq(students.userId, userId))
      .limit(1);
    if (existing.length === 0) return;
    studentId = existing[0]!.id;
  } else {
    studentId = studentRows[0]!.id;
  }

  // Check if parent already exists for this student
  const parentRows = await database
    .select({ id: parents.id })
    .from(parents)
    .where(eq(parents.studentId, studentId))
    .limit(1);

  if (parentRows.length > 0) {
    logger.info("Parent already exists for student, skipping parent insert");
    return;
  }

  await database.insert(parents).values({
    studentId,
    name: "Neerasa Mohana Rao",
    phone: "9492079771",
    email: "nvedavarshit@gmail.com",
    relationship: "Father",
    isPrimary: true,
  });

  logger.info("Parent inserted for student", { studentId });
}
