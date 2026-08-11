import { and, eq, inArray } from "drizzle-orm";

import { roles, userRoles } from "@/db";
import { db } from "@/lib/db";

type DbClient = Pick<typeof db, "select" | "insert" | "delete">;

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

  /**
   * Returns each role assignment with its scope (if any).
   * A row with a null scope means unrestricted access for that role.
   */
  async findRoleScopesByUserId(
    userId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<
    Array<{
      roleCode: string;
      scopeType: string | null;
      scopeId: string | null;
    }>
  > {
    const rows = await dbClient
      .select({
        roleCode: roles.code,
        scopeType: userRoles.scopeType,
        scopeId: userRoles.scopeId,
      })
      .from(userRoles)
      .innerJoin(
        roles,
        eq(userRoles.roleId, roles.id)
      )
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => ({
      roleCode: row.roleCode,
      scopeType: row.scopeType ?? null,
      scopeId: row.scopeId ?? null,
    }));
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
    dbClient: DbClient = db,
    assignment?: {
      scopeType?: string | null;
      scopeId?: string | null;
      assignedBy?: string | null;
    }
  ) {
    const rows = await dbClient
      .insert(userRoles)
      .values({
        userId,
        roleId,
        scopeType: assignment?.scopeType ?? null,
        scopeId: assignment?.scopeId ?? null,
        assignedBy: assignment?.assignedBy ?? null,
      })
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

  /**
   * Replaces the scoped assignment rows for a (user, role, scopeType)
   * triplet. Scope ids list is the full desired set — rows outside the
   * set are deleted, absent rows are inserted.
   */
  async replaceRoleScopes(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeIds: string[],
    dbClient: DbClient = db,
    assignedBy?: string | null
  ): Promise<void> {
    await dbClient
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.scopeType, scopeType)
        )
      );

    if (scopeIds.length > 0) {
      await dbClient
        .insert(userRoles)
        .values(
          scopeIds.map((scopeId) => ({
            userId,
            roleId,
            scopeType,
            scopeId,
            assignedBy: assignedBy ?? null,
          }))
        )
        .onConflictDoNothing();
    }
  },
};

export default userRoleRepository;