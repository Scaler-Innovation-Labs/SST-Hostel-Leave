import { departments } from "@/db";
import type { db } from "@/lib/db";

export async function seedDepartments(
  database: typeof db
) {
  await database
    .insert(departments)
    .values([
      {
        code: "CS-AI",
        name: "Computer Science Engineering",
      },
      {
        code: "AI-B",
        name: "Artificial Intelligence and Business",
      },
    ])
    .onConflictDoNothing();
}