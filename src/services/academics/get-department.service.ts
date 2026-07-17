import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments } from "@/db/schema/academics";

export async function getDepartmentById(id: string) {
  const [row] = await db.select().from(departments).where(eq(departments.id, id));
  return row ?? null;
}
