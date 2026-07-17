import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { movementEvents, movementStates, students, users } from "@/db";
import { db } from "@/lib/db";

export type MovementEventRow = InferSelectModel<typeof movementEvents>;
export type NewMovementEvent = InferInsertModel<
	typeof movementEvents
>;

type MovementDbClient = Pick<typeof db, "insert" | "select">;

import type { MovementEvent } from "@/constants/movement/movement-event";

export type MovementEventFilters = {
  studentId?: string;
  eventType?: MovementEvent;
  leaveRequestId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
};

const fromStates = alias(movementStates, "from_states");
const toStates = alias(movementStates, "to_states");

export const movementEventRepository = {
	async create(
		input: NewMovementEvent,
		dbClient: MovementDbClient = db
	): Promise<MovementEventRow> {
		const rows = await dbClient
			.insert(movementEvents)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async findById(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<MovementEventRow | null> {
		const rows = await dbClient
			.select()
			.from(movementEvents)
			.where(eq(movementEvents.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findLatestByStudentId(
		studentId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<MovementEventRow | null> {
		const rows = await dbClient
			.select()
			.from(movementEvents)
			.where(eq(movementEvents.studentId, studentId))
			.orderBy(desc(movementEvents.occurredAt))
			.limit(1);

		return rows[0] ?? null;
	},

  async findByFilters(
    filters: MovementEventFilters,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    items: Array<
      MovementEventRow & {
        studentName: string | null;
        studentRollNumber: string | null;
        fromStateName: string | null;
        toStateName: string | null;
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.studentId) {
      conditions.push(eq(movementEvents.studentId, filters.studentId));
    }
    if (filters.eventType) {
      conditions.push(eq(movementEvents.eventType, filters.eventType));
    }
    if (filters.dateFrom) {
      conditions.push(gte(movementEvents.occurredAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(movementEvents.occurredAt, filters.dateTo));
    }
    if (filters.leaveRequestId) {
      conditions.push(eq(movementEvents.leaveRequestId, filters.leaveRequestId));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(users.fullName, `%${filters.search}%`),
          ilike(students.rollNumber, `%${filters.search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(movementEvents)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select()
      .from(movementEvents)
      .leftJoin(students, eq(movementEvents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(fromStates, eq(movementEvents.fromState, fromStates.code))
      .leftJoin(toStates, eq(movementEvents.toState, toStates.code))
      .where(whereClause)
      .orderBy(desc(movementEvents.occurredAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      items: rows.map((row) => ({
        ...row.movement_events,
        studentName: row.users?.fullName ?? null,
        studentRollNumber: row.students?.rollNumber ?? null,
        fromStateName: row.from_states?.name ?? null,
        toStateName: row.to_states?.name ?? null,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

  async countRecent(
    since: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(movementEvents)
      .where(gte(movementEvents.occurredAt, since));
    return Number(result[0]?.count ?? 0);
  },
};

export default movementEventRepository;
