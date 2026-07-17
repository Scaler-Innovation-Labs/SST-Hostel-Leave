import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, inArray, like, not, or, sql } from "drizzle-orm";

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
  excludeRole?: string;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

type UserReadDb = Pick<typeof db, "select">;
type UserWriteDb = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export const userRepository = {
  async findAll(
    filters: UserFilters,
    dbClient: UserReadDb = db
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

    if (filters.excludeRole) {
      const userWithExcludedRole = dbClient
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.code, filters.excludeRole));
      conditions.push(not(inArray(users.id, userWithExcludedRole)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const orderByColumn =
      filters.sortBy === "fullName" ? users.fullName :
      filters.sortBy === "email" ? users.email :
      filters.sortBy === "phone" ? users.phone :
      users.createdAt;
    const orderByDirection = filters.sortOrder === "asc" ? asc : desc;

    const rows = await dbClient
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(orderByDirection(orderByColumn))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const userIds = rows.map((r) => r.id);
    const roleMap = new Map<string, Array<{ roleId: string; roleCode: string; roleName: string; assignedAt: Date }>>();
    if (userIds.length > 0) {
      const allUserRoles = await dbClient
        .select({
          userId: userRoles.userId,
          roleId: roles.id,
          roleCode: roles.code,
          roleName: roles.name,
          assignedAt: userRoles.assignedAt,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds));

      for (const ur of allUserRoles) {
        const list = roleMap.get(ur.userId);
        if (list) {
          list.push({ roleId: ur.roleId, roleCode: ur.roleCode, roleName: ur.roleName, assignedAt: ur.assignedAt });
        } else {
          roleMap.set(ur.userId, [{ roleId: ur.roleId, roleCode: ur.roleCode, roleName: ur.roleName, assignedAt: ur.assignedAt }]);
        }
      }
    }

    const items: UserWithRoles[] = rows.map((row) => ({
      ...row,
      userRoles: roleMap.get(row.id) ?? [],
    }));

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
    dbClient: UserReadDb = db
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
    dbClient: UserReadDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByClerkId(
    clerkId: string,
    dbClient: UserReadDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByEmail(
    email: string,
    dbClient: UserReadDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByPhone(
    phone: string,
    dbClient: UserReadDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByIds(
    ids: string[],
    dbClient: UserReadDb = db
  ): Promise<User[]> {
    if (ids.length === 0) return [];

    return await dbClient
      .select()
      .from(users)
      .where(inArray(users.id, ids));
  },

  async count(
    dbClient: UserReadDb = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(users);
    return Number(result[0]?.count ?? 0);
  },

  async create(
    input: {
      fullName: string;
      email?: string;
      phone?: string;
      gender?: "MALE" | "FEMALE" | "OTHER" | null;
      clerkId?: string;
      hostelId?: string;
      isActive?: boolean;
      profileImageUrl?: string;
    },
    dbClient: UserWriteDb = db
  ): Promise<User> {
    const rows = await dbClient
      .insert(users)
      .values({
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        gender: input.gender ?? null,
        clerkId: input.clerkId ?? null,
        hostelId: input.hostelId ?? null,
        isActive: input.isActive ?? true,
        profileImageUrl: input.profileImageUrl ?? null,
      })
      .returning();

    return rows[0]!;
  },

  async updateClerkId(
    id: string,
    clerkId: string,
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .update(users)
      .set({ clerkId })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateProfile(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      profileImageUrl?: string | null;
    },
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.fullName !== undefined) set.fullName = input.fullName;
    if (input.email !== undefined) set.email = input.email;
    if (input.profileImageUrl !== undefined) set.profileImageUrl = input.profileImageUrl;

    const rows = await dbClient
      .update(users)
      .set(set)
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async softDelete(
    id: string,
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .update(users)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async deactivate(
    id: string,
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async activate(
    id: string,
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const rows = await dbClient
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateUser(
    id: string,
    input: Partial<{
      fullName: string;
      email: string;
      phone: string;
      gender: "MALE" | "FEMALE" | "OTHER" | null;
      hostelId: string | null;
      isActive: boolean;
      profileImageUrl: string | null;
    }>,
    dbClient: UserWriteDb = db
  ): Promise<User | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        set[key] = value;
      }
    }

    const rows = await dbClient
      .update(users)
      .set(set)
      .where(eq(users.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async replaceRoles(
    userId: string,
    roleIds: string[],
    dbClient: UserWriteDb = db
  ): Promise<void> {
    await dbClient
      .delete(userRoles)
      .where(eq(userRoles.userId, userId));

    if (roleIds.length > 0) {
      await dbClient
        .insert(userRoles)
        .values(roleIds.map((roleId) => ({ userId, roleId })));
    }
  },
};

export default userRepository;
