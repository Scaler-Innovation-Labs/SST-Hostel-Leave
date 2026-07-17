import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";

import { academicGroups, movementStates, students, users } from "@/db";
import { db } from "@/lib/db";

export type Student = InferSelectModel<typeof students>;
export type NewStudent = InferInsertModel<typeof students>;

type StudentDbClient = Pick<typeof db, "select">;
type StudentWriteClient = Pick<typeof db, "insert" | "update" | "delete">;

export type StudentWithRelations = {
  student: Student;
  user: typeof users.$inferSelect | null;
  locationState: typeof movementStates.$inferSelect | null;
};

export type StudentFilters = {
  hostelId?: string;
  locationState?: string;
  search?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export const studentRepository = {
	async findById(
		id: string,
		dbClient: StudentDbClient = db
	): Promise<Student | null> {
		const rows = await dbClient
			.select()
			.from(students)
			.where(eq(students.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByIdForUpdate(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<Student | null> {
		const rows = await dbClient
			.select()
			.from(students)
			.where(eq(students.id, id))
			.limit(1)
			.for("update");

		return rows[0] ?? null;
	},

	async findByUserId(
		userId: string,
		dbClient: StudentDbClient = db
	): Promise<Student | null> {
		const rows = await dbClient
			.select()
			.from(students)
			.where(eq(students.userId, userId))
			.limit(1);

		return rows[0] ?? null;
	},

  async findPolicyContextByUserId(
    userId: string,
    dbClient: StudentDbClient = db
  ): Promise<{ studentBatchYear: number; hostelId: string | null } | null> {
    const rows = await dbClient
      .select({
        studentBatchYear: academicGroups.batchYear,
        hostelId: users.hostelId,
      })
      .from(students)
      .innerJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(students.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  },

	async updateCurrentLocationState(
		id: string,
		state: string,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<Student | null> {
		const rows = await dbClient
			.update(students)
			.set({ currentLocationState: state })
			.where(eq(students.id, id))
			.returning();

		return rows[0] ?? null;
	},

  async findByFilters(
    filters: StudentFilters,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    items: StudentWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.locationState) {
      conditions.push(eq(students.currentLocationState, filters.locationState));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(users.fullName, searchPattern),
          like(students.rollNumber, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const orderByColumn =
      filters.sortBy === "rollNumber" ? students.rollNumber :
      filters.sortBy === "currentLocationState" ? students.currentLocationState :
      students.createdAt;
    const orderByDirection = filters.sortOrder === "asc" ? asc : desc;

    const rows = await dbClient
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(movementStates, eq(students.currentLocationState, movementStates.code))
      .where(whereClause)
      .orderBy(orderByDirection(orderByColumn))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      items: rows.map((row) => ({
        student: row.students,
        user: row.users ?? null,
        locationState: row.movement_states ?? null,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

  async findByIdWithRelations(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<StudentWithRelations | null> {
    const rows = await dbClient
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(movementStates, eq(students.currentLocationState, movementStates.code))
      .where(eq(students.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      student: row.students,
      user: row.users ?? null,
      locationState: row.movement_states ?? null,
    };
  },

  async findByLocationState(
    state: string,
    dbClient: StudentDbClient = db
  ): Promise<Student[]> {
    const rows = await dbClient
      .select()
      .from(students)
      .where(eq(students.currentLocationState, state));

    return rows;
  },

  async countAll(
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(students);
    return Number(result[0]?.count ?? 0);
  },

  async create(
    data: NewStudent,
    dbClient: StudentWriteClient = db
  ): Promise<Student> {
    const rows = await dbClient.insert(students).values(data).returning();
    return rows[0]!;
  },

  async updateById(
    id: string,
    data: Partial<NewStudent>,
    dbClient: StudentWriteClient = db
  ): Promise<Student | null> {
    const rows = await dbClient
      .update(students)
      .set(data)
      .where(eq(students.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async deleteById(id: string, dbClient: StudentWriteClient = db): Promise<void> {
    await dbClient.delete(students).where(eq(students.id, id));
  },

  async countByLocationState(
    state: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.currentLocationState, state));
    return Number(result[0]?.count ?? 0);
  },
};

export default studentRepository;
