import { eq } from "drizzle-orm";

import { roles, userRoles } from "@/db";
import { db } from "@/lib/db";

type DbClient = Pick<typeof db, "select" | "insert">;

export const userRoleRepository = {
  async findRoleCodesByUserId(
    userId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<string[]> {
    const rows = await dbClient
      .select({
        code: roles.code,
      })
      .from(userRoles)
      .innerJoin(
        roles,
        eq(userRoles.roleId, roles.id)
      )
      .where(eq(userRoles.userId, userId));

    return rows
      .map((row) => row.code)
      .filter(
        (code): code is string => code !== null
      );
  },

  async findByRoleId(
    roleId: string,
    dbClient: Pick<typeof db, "select"> = db
  ) {
    const rows = await dbClient
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return rows[0] ?? null;
  },

  async findRoleByCode(
    code: string,
    dbClient: Pick<typeof db, "select"> = db
  ) {
    const rows = await dbClient
      .select()
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1);

    return rows[0] ?? null;
  },

  async create(
    userId: string,
    roleId: string,
    dbClient: DbClient = db
  ) {
    const rows = await dbClient
      .insert(userRoles)
      .values({ userId, roleId })
      .onConflictDoNothing()
      .returning();

    return rows[0] ?? null;
  },
};

export default userRoleRepository;