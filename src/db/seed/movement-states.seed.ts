import { movementStates } from "@/db";
import type { db } from "@/lib/db";

export async function seedMovementStates(
  database: typeof db
) {
  await database
    .insert(movementStates)
    .values([
      {
        code: "IN_HOSTEL",
        name: "Inside Hostel",
      },
      {
        code: "APPROVED_LEAVE",
        name: "Leave Approved",
      },
      {
        code: "CHECKED_OUT",
        name: "Checked Out",
      },
      {
        code: "OUTSIDE_HOSTEL",
        name: "Outside Hostel",
      },

      {
        code: "OVERDUE",
        name: "Overdue",
      },
    ])
    .onConflictDoNothing();
}