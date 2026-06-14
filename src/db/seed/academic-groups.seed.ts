import { eq } from "drizzle-orm";

import { academicGroups, departments } from "@/db";
import type { db } from "@/lib/db";

export async function seedAcademicGroups(
  database: typeof db
) {
  const deptRows = await database
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.code, "CS-AI"))
    .limit(1);

  if (deptRows.length === 0) {
    console.warn("Department CS-AI not found, skipping academic groups");
    return;
  }

  const deptId = deptRows[0]!.id;

  await database
    .insert(academicGroups)
    .values([
      {
        departmentId: deptId,
        batchYear: 2024,
        name: "CSE AI Batch 2024",
        groupCode: "A",
        isActive: true,
      },
    ])
    .onConflictDoNothing();
}
