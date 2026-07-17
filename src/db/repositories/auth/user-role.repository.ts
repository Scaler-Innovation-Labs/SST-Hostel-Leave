import { eq, inArray } from "drizzle-orm";

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

  async findRolesByCodes(
    codes: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ id: string; code: string }>> {
    if (codes.length === 0) return [];
    return dbClient
      .select({ id: roles.id, code: roles.code })
      .from(roles)
      .where(inArray(roles.code, codes));
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

  async findUserIdsByRoleCode(
    roleCode: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<string[]> {
    const rows = await dbClient
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(roles.code, roleCode));
    return rows.map((r) => r.userId);
  },
};

export default userRoleRepository;