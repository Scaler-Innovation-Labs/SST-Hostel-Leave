import { eq } from "drizzle-orm";

import { students, users } from "@/db";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";

export async function deleteStudent(id: string) {
  return transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError("Student");
    }

    const userId = existing[0]!.userId;

    await tx.delete(students).where(eq(students.id, id));

    await tx.delete(users).where(eq(users.id, userId));

    return { deleted: true };
  });
}
