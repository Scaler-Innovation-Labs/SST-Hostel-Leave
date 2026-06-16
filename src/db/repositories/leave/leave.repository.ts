import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, isNull, like, lte, or, sql } from "drizzle-orm";

import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveRequests, leaveTypes, students, users } from "@/db";
import { db } from "@/lib/db";

type LeaveDbClient = Pick<typeof db, "insert" | "select" | "update">;

export type LeaveRequest = InferSelectModel<typeof leaveRequests>;
export type NewLeaveRequest = InferInsertModel<
	typeof leaveRequests
>;

export type LeaveWithRelations = {
  leave: LeaveRequest;
  student: typeof students.$inferSelect | null;
  user: typeof users.$inferSelect | null;
  leaveType: typeof leaveTypes.$inferSelect | null;
};

import type { LeaveRequestStatus } from "@/constants/leave/leave-status";

export type LeaveFilters = {
  studentId?: string;
  status?: LeaveRequestStatus;
  leaveTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const leaveRepository = {
	async create(
		input: NewLeaveRequest,
		dbClient: LeaveDbClient = db
	): Promise<LeaveRequest> {
		const rows = await dbClient
			.insert(leaveRequests)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async findById(id: string, dbClient: Pick<typeof db, "select"> = db): Promise<LeaveRequest | null> {
		const rows = await dbClient
			.select()
			.from(leaveRequests)
			.where(eq(leaveRequests.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByIdForUpdate(id: string, dbClient: Pick<typeof db, "select"> = db): Promise<LeaveRequest | null> {
		const rows = await dbClient
			.select()
			.from(leaveRequests)
			.where(eq(leaveRequests.id, id))
			.limit(1)
			.for("update");

		return rows[0] ?? null;
	},

	async findOverlappingLeaves(
		studentId: string,
		startAt: Date,
		endAt: Date,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LeaveRequest[]> {
		// overlap if existing.end_at >= startAt AND existing.start_at <= endAt
		const rows = await dbClient
			.select()
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.studentId, studentId),
					gte(leaveRequests.endAt, startAt),
					lte(leaveRequests.startAt, endAt)
				)
			)
			.orderBy(leaveRequests.startAt);

		return rows;
	},

	async updateById(
  id: string,
  values: Partial<NewLeaveRequest>,
  dbClient: Pick<typeof db, "update"> = db
): Promise<LeaveRequest | null> {
  const rows = await dbClient
    .update(leaveRequests)
    .set(values)
    .where(
      eq(leaveRequests.id, id)
    )
    .returning();

  return rows[0] ?? null;
},
	async updateCurrentStep(
		id: string,
		currentStepKey: string | null,
		currentStepOrder: number | null,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<LeaveRequest | null> {
		const rows = await dbClient
			.update(leaveRequests)
			.set({ currentStepKey, currentStepOrder })
			.where(eq(leaveRequests.id, id))
			.returning();

		return rows[0] ?? null;
	},

	async findExpiredLeaves(
		before: Date,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LeaveRequest[]> {
		const rows = await dbClient
			.select()
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.status, LEAVE_REQUEST_STATUS.APPROVED),
					lte(leaveRequests.endAt, before),
					isNull(leaveRequests.actualReturnAt)
				)
			)
			.orderBy(leaveRequests.endAt);

		return rows;
	},

  async findByFilters(
    filters: LeaveFilters,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<PaginatedResult<LeaveWithRelations>> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.studentId) {
      conditions.push(eq(leaveRequests.studentId, filters.studentId));
    }
    if (filters.status) {
      conditions.push(eq(leaveRequests.status, filters.status));
    }
    if (filters.leaveTypeId) {
      conditions.push(eq(leaveRequests.leaveTypeId, filters.leaveTypeId));
    }
    if (filters.startDate) {
      conditions.push(gte(leaveRequests.startAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(leaveRequests.endAt, filters.endDate));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(leaveRequests.requestNumber, searchPattern),
          like(users.fullName, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select()
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(whereClause)
      .orderBy(desc(leaveRequests.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      items: rows.map((row) => ({
        leave: row.leave_requests,
        student: row.students ?? null,
        user: row.users ?? null,
        leaveType: row.leave_types ?? null,
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
  ): Promise<LeaveWithRelations | null> {
    const rows = await dbClient
      .select()
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(eq(leaveRequests.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      leave: row.leave_requests,
      student: row.students ?? null,
      user: row.users ?? null,
      leaveType: row.leave_types ?? null,
    };
  },

  async countByLeaveType(
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const rows = await dbClient
      .select({
        name: leaveTypes.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .groupBy(leaveTypes.id, leaveTypes.name);

    return rows;
  },

  async countByStatus(
    status: LeaveRequestStatus,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequests)
      .where(eq(leaveRequests.status, status));
    return Number(result[0]?.count ?? 0);
  },

  async countByDateRange(
    startDate: Date,
    endDate: Date,
    status?: LeaveRequestStatus,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions = [
      gte(leaveRequests.createdAt, startDate),
      lte(leaveRequests.createdAt, endDate),
    ];
    if (status) {
      conditions.push(eq(leaveRequests.status, status));
    }

    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveRequests.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveRequests.createdAt})`)
      .orderBy(sql`DATE(${leaveRequests.createdAt})`);

    return rows;
  },

  async countAll(
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequests);
    return Number(result[0]?.count ?? 0);
  },
};

export default leaveRepository;
