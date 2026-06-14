import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { roles, userRoles, users } from "@/db";
import { db } from "@/lib/db";

export type User = InferSelectModel<typeof users>;

export type UserWithRoles = User & {
  userRoles: Array<{
    roleId: string;
    roleCode: string;
    roleName: string;
    assignedAt: Date;
  }>;
};

export type UserFilters = {
  search?: string;
  role?: string;
  isActive?: boolean;
  page: number;
  limit: number;
};

type UserDbClient = Pick<typeof db, "select">;

export const userRepository = {
  async findAll(
    filters: UserFilters,
    dbClient: UserDbClient = db
  ): Promise<{
    items: UserWithRoles[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(like(users.fullName, pattern), like(users.email, pattern))
      );
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(users.isActive, filters.isActive));
    }

    if (filters.role) {
      const userWithRole = dbClient
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.code, filters.role));
      conditions.push(inArray(users.id, userWithRole));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const items: UserWithRoles[] = await Promise.all(
      rows.map(async (row) => {
        const userRolesRows = await dbClient
          .select({
            roleId: roles.id,
            roleCode: roles.code,
            roleName: roles.name,
            assignedAt: userRoles.assignedAt,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, row.id));

        return {
          ...row,
          userRoles: userRolesRows,
        };
      })
    );

    return {
      items,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

  async findByIdWithRoles(
    id: string,
    dbClient: UserDbClient = db
  ): Promise<UserWithRoles | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const userRolesRows = await dbClient
      .select({
        roleId: roles.id,
        roleCode: roles.code,
        roleName: roles.name,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id));

    return {
      ...rows[0]!,
      userRoles: userRolesRows,
    };
  },

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<User | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async count(
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(users);
    return Number(result[0]?.count ?? 0);
  },
};

export default userRepository;
