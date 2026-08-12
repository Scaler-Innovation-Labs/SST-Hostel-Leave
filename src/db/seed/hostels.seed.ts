import { hostels } from "@/db";
import type { db } from "@/lib/db";

export async function seedHostels(
  database: typeof db
) {
  await database
    .insert(hostels)
    .values([
      {
        code: "UNI-1",
        name: "Neeladri Hostel",
        slackAdminGroupId: "S0123NEELADRI-ADMIN",
      },
      {
        code: "UNI-2",
        name: "Velankani Hostel",
        slackAdminGroupId: "S0123VELANKANI-ADMIN",
      },
    ])
    .onConflictDoNothing();
}