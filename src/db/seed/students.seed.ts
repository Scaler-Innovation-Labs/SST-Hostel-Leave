import { eq } from "drizzle-orm";

import { academicGroups, parents, students, users } from "@/db";
import type { db } from "@/lib/db";

export async function seedStudents(
  database: typeof db
) {
  const userRows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "neerasa.24bcs10005@sst.scaler.com"))
    .limit(1);

  if (userRows.length === 0) {
    console.warn("Student user not found, skipping student seed");
    return;
  }

  const groupRows = await database
    .select({ id: academicGroups.id })
    .from(academicGroups)
    .limit(1);

  if (groupRows.length === 0) {
    console.warn("No academic groups found, skipping student seed");
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

  if (studentRows.length === 0) {
    console.warn("Student already exists, skipping parent insert");
    return;
  }

  const studentId = studentRows[0]!.id;

  await database.insert(parents).values({
    studentId,
    name: "Neerasa Mohana Rao",
    phone: "9492079771",
    email: "nvedavarshit@gmail.com",
    relationship: "Father",
    isPrimary: true,
  });
}
