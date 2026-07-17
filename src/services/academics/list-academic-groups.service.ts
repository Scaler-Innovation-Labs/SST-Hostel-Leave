import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { academicGroups } from "@/db/schema/academics";

export async function listAcademicGroups() {
  return db.select().from(academicGroups).orderBy(asc(academicGroups.name));
}
