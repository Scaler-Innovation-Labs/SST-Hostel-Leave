import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { hostels } from "@/db/schema/hostel";

export async function getHostelById(id: string) {
  const [row] = await db.select().from(hostels).where(eq(hostels.id, id));
  return row ?? null;
}
