import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

import { parents, students, users } from "@/db";
import { db } from "@/lib/db";

export type Parent = InferSelectModel<typeof parents>;
export type NewParent = InferInsertModel<typeof parents>;

type ParentReadClient = Pick<typeof db, "select">;
type ParentWriteClient = Pick<typeof db, "insert" | "update" | "delete">;

export const parentRepository = {
  async findById(
    id: string,
    dbClient: ParentReadClient = db
  ): Promise<Parent | null> {
    const rows = await dbClient
      .select()
      .from(parents)
      .where(eq(parents.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findPrimaryByStudentId(
    studentId: string,
    dbClient: ParentReadClient = db
  ): Promise<Parent | null> {
    const rows = await dbClient
      .select()
      .from(parents)
      .where(
        and(
          eq(parents.studentId, studentId),
          eq(parents.isPrimary, true)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  },

  async findByPhone(
    phone: string,
    dbClient: ParentReadClient = db
  ): Promise<Parent | null> {
    const rows = await dbClient
      .select()
      .from(parents)
      .where(eq(parents.phone, phone))
      .limit(1);

    return rows[0] ?? null;
  },

  async findAll(
    filters: {
      search?: string;
      page: number;
      limit: number;
    },
    dbClient: ParentReadClient = db
  ): Promise<{
    items: Array<Parent & { studentRollNumber: string | null; studentName: string | null }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(parents.name, pattern),
          like(parents.phone, pattern),
          like(parents.email ?? "", pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(parents)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select({
        parent: parents,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
      })
      .from(parents)
      .leftJoin(students, eq(parents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause)
      .orderBy(desc(parents.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      items: rows.map((r) => ({
        ...r.parent,
        studentName: r.studentName,
        studentRollNumber: r.studentRollNumber,
      })),
      total,
      page: filters.page,
      totalPages,
    };
  },

  async create(
    data: NewParent,
    dbClient: ParentWriteClient = db
  ): Promise<Parent> {
    const rows = await dbClient.insert(parents).values(data).returning();
    return rows[0]!;
  },

  async updateById(
    id: string,
    data: Partial<NewParent>,
    dbClient: ParentWriteClient = db
  ): Promise<Parent | null> {
    const rows = await dbClient
      .update(parents)
      .set(data)
      .where(eq(parents.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async deleteById(id: string, dbClient: ParentWriteClient = db): Promise<void> {
    await dbClient.delete(parents).where(eq(parents.id, id));
  },
};

export default parentRepository;
