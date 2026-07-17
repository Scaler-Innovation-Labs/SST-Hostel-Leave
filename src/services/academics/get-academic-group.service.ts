import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicGroups } from "@/db/schema/academics";

export async function getAcademicGroupById(id: string) {
  const [row] = await db.select().from(academicGroups).where(eq(academicGroups.id, id));
  return row ?? null;
}
