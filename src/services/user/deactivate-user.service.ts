import { eq } from "drizzle-orm";

import { users } from "@/db";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export async function deactivateUser(id: string) {
  const rows = await db
    .update(users)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (rows.length === 0) {
    throw new NotFoundError("User");
  }

  return rows[0]!;
}

export async function activateUser(id: string) {
  const rows = await db
    .update(users)
    .set({
      isActive: true,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (rows.length === 0) {
    throw new NotFoundError("User");
  }

  return rows[0]!;
}

