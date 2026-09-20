import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";

import {
	LATE_STAY_AUTH_STATUS,
	type LateStayAuthStatus,
} from "@/constants/leave/late-stay-authorization";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { lateStayAuthorizations, leaveRequests, leaveTypes, students, users } from "@/db";
import { db } from "@/lib/db";

export type LateStayAuthorization = InferSelectModel<
	typeof lateStayAuthorizations
>;
export type NewLateStayAuthorization = InferInsertModel<
	typeof lateStayAuthorizations
>;

type AuthDbClient = Pick<typeof db, "select" | "insert" | "update">;

/** A live authorization occupies the same temporal window: ACTIVE, or still pending a decision. */
export const LIVE_AUTH_STATUSES: readonly LateStayAuthStatus[] = [
	LATE_STAY_AUTH_STATUS.PENDING_POC,
	LATE_STAY_AUTH_STATUS.PENDING_ADMIN,
	LATE_STAY_AUTH_STATUS.ACTIVE,
] as const;

/** Statuses permitted to transition into ACTIVE (approve path). */
const PENDING_STATUSES: readonly LateStayAuthStatus[] = [
	LATE_STAY_AUTH_STATUS.PENDING_POC,
	LATE_STAY_AUTH_STATUS.PENDING_ADMIN,
] as const;

export const lateStayAuthorizationRepository = {
	async create(
		input: NewLateStayAuthorization,
		dbClient: AuthDbClient = db
	): Promise<LateStayAuthorization> {
		const rows = await dbClient
			.insert(lateStayAuthorizations)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async findById(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization | null> {
		const rows = await dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(eq(lateStayAuthorizations.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByIdForUpdate(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization | null> {
		const rows = await dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(eq(lateStayAuthorizations.id, id))
			.limit(1)
			.for("update");

		return rows[0] ?? null;
	},

	/** Pessimistic lock used by the claim flow to serialize concurrent claims. */
	async findActiveForStudentForUpdate(
		studentId: string,
		leaveTypeId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization[]> {
		return dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(
				and(
					eq(lateStayAuthorizations.studentId, studentId),
					eq(lateStayAuthorizations.leaveTypeId, leaveTypeId),
					eq(lateStayAuthorizations.status, LATE_STAY_AUTH_STATUS.ACTIVE)
				)
			)
			.orderBy(desc(lateStayAuthorizations.version))
			.for("update", { of: lateStayAuthorizations });
	},

	/** Non-locking read of the student's ACTIVE authorizations for a type. */
	async findActiveByStudent(
		studentId: string,
		leaveTypeId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization[]> {
		return dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(
				and(
					eq(lateStayAuthorizations.studentId, studentId),
					eq(lateStayAuthorizations.leaveTypeId, leaveTypeId),
					eq(lateStayAuthorizations.status, LATE_STAY_AUTH_STATUS.ACTIVE)
				)
			)
			.orderBy(desc(lateStayAuthorizations.version));
	},

	/**
	 * Overlap check for the create-version guard: any live (pending or
	 * active) authorization of the same student + leave type whose validity
	 * window intersects [validFrom, validUntil].
	 */
	async findLiveOverlapping(
		params: {
			studentId: string;
			leaveTypeId: string;
			validFrom: Date;
			validUntil: Date;
			excludeAuthorizationId?: string;
		},
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization[]> {
		return dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(
				and(
					eq(lateStayAuthorizations.studentId, params.studentId),
					eq(lateStayAuthorizations.leaveTypeId, params.leaveTypeId),
					inArray(lateStayAuthorizations.status, [...LIVE_AUTH_STATUSES]),
					lte(lateStayAuthorizations.validFrom, params.validUntil),
					gte(lateStayAuthorizations.validUntil, params.validFrom),
					...(params.excludeAuthorizationId
						? [ne(lateStayAuthorizations.id, params.excludeAuthorizationId)]
						: [])
				)
			)
			.orderBy(asc(lateStayAuthorizations.validFrom));
	},

	async findByStudent(
		studentId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<LateStayAuthorization[]> {
		return dbClient
			.select()
			.from(lateStayAuthorizations)
			.where(eq(lateStayAuthorizations.studentId, studentId))
			.orderBy(desc(lateStayAuthorizations.createdAt));
	},

	/** Role-scoped list: POC sees own-hostel students, admins see all. */
	async findByFilters(
		filters: {
			status?: LateStayAuthStatus;
			hostelIds?: string[];
			page: number;
			limit: number;
		},
		dbClient: Pick<typeof db, "select"> = db
	) {
		const conditions = [
			...(filters.status
				? [eq(lateStayAuthorizations.status, filters.status)]
				: []),
			...(filters.hostelIds && filters.hostelIds.length > 0
				? [inArray(users.hostelId, filters.hostelIds)]
				: []),
		];

		const where = conditions.length > 0 ? and(...conditions) : undefined;

		const rows = await dbClient
			.select({
				authorization: lateStayAuthorizations,
				student: students,
				studentUser: users,
				leaveType: leaveTypes,
			})
			.from(lateStayAuthorizations)
			.innerJoin(students, eq(lateStayAuthorizations.studentId, students.id))
			.innerJoin(users, eq(students.userId, users.id))
			.innerJoin(leaveTypes, eq(lateStayAuthorizations.leaveTypeId, leaveTypes.id))
			.where(where)
			.orderBy(desc(lateStayAuthorizations.submittedAt))
			.limit(filters.limit)
			.offset((filters.page - 1) * filters.limit);

		const countRows = await dbClient
			.select({ count: sql<number>`count(*)::int` })
			.from(lateStayAuthorizations)
			.innerJoin(students, eq(lateStayAuthorizations.studentId, students.id))
			.where(where);

		const total = countRows[0]?.count ?? 0;

		return {
			items: rows,
			total,
			page: filters.page,
			limit: filters.limit,
			totalPages: Math.max(1, Math.ceil(total / filters.limit)),
		};
	},

	async updateById(
		id: string,
		values: Partial<NewLateStayAuthorization>,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<LateStayAuthorization | null> {
		const rows = await dbClient
			.update(lateStayAuthorizations)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(lateStayAuthorizations.id, id))
			.returning();

		return rows[0] ?? null;
	},

	/**
	 * Atomic status transition with expected-state guard. Returns the updated
	 * row or null when the row is not in the expected state (lost race).
	 */
	async transitionStatus(
		id: string,
		expected: readonly LateStayAuthStatus[],
		next: LateStayAuthStatus,
		extra: Partial<NewLateStayAuthorization> = {},
		dbClient: Pick<typeof db, "update"> = db
	): Promise<LateStayAuthorization | null> {
		const rows = await dbClient
			.update(lateStayAuthorizations)
			.set({
				status: next,
				...extra,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(lateStayAuthorizations.id, id),
					inArray(lateStayAuthorizations.status, [...expected])
				)
			)
			.returning();

		return rows[0] ?? null;
	},

	/** Supersede flow: within one tx, activate V(n) and retire V(n-1). */
	async activateAndSupersede(
		childId: string,
		parentId: string,
		approvalFields: {
			pocApprovedAt?: Date;
			pocApprovedBy?: string;
			adminApprovedAt?: Date;
			adminApprovedBy?: string;
		},
		dbClient: Pick<typeof db, "update"> = db
	): Promise<LateStayAuthorization | null> {
		const child = await dbClient
			.update(lateStayAuthorizations)
			.set({
				status: LATE_STAY_AUTH_STATUS.ACTIVE,
				...approvalFields,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(lateStayAuthorizations.id, childId),
					inArray(lateStayAuthorizations.status, [...PENDING_STATUSES])
				)
			)
			.returning();

		if (child.length === 0) return null;

		await dbClient
			.update(lateStayAuthorizations)
			.set({
				status: LATE_STAY_AUTH_STATUS.SUPERSEDED,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(lateStayAuthorizations.id, parentId),
					eq(lateStayAuthorizations.status, LATE_STAY_AUTH_STATUS.ACTIVE)
				)
			);

		return child[0] ?? null;
	},

	/** Expiry cron pass: ACTIVE rows past validUntil → EXPIRED. */
	async expireDue(
		before: Date,
		_limit: number | undefined,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<LateStayAuthorization[]> {
		return dbClient
			.update(lateStayAuthorizations)
			.set({
				status: LATE_STAY_AUTH_STATUS.EXPIRED,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(lateStayAuthorizations.status, LATE_STAY_AUTH_STATUS.ACTIVE),
					lte(lateStayAuthorizations.validUntil, before)
				)
			)
			.returning();
	},

	/**
	 * Claim idempotency: find a live occurrence for this authorization +
	 * date before inserting. Excluded statuses mirror the partial unique
	 * index (CANCELLED / REJECTED don't count).
	 */
	async findOccurrence(
		authorizationId: string,
		occurrenceDate: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<{ id: string } | null> {
		const rows = await dbClient
			.select({ id: leaveRequests.id })
			.from(leaveRequests)
			.where(
				and(
					sql`${leaveRequests.metadata} ->> 'authorizationId' = ${authorizationId}`,
					sql`${leaveRequests.metadata} ->> 'occurrenceDate' = ${occurrenceDate}`,
					sql`${leaveRequests.status} NOT IN ('CANCELLED', 'REJECTED')`
				)
			)
			.limit(1);

		return rows[0] ?? null;
	},

	/**
	 * Cross-version claim guard: find a live occurrence for this student +
	 * leave type + calendar date under ANY authorization. Per-auth
	 * findOccurrence cannot see a sibling version's claim (a V1 claim would
	 * not block a V2 claim for the same night) — the claim flow checks this
	 * so one night yields at most one live occurrence per student + type.
	 * Excluded statuses mirror the partial unique index.
	 */
	async findLiveOccurrenceForStudentDate(
		studentId: string,
		leaveTypeId: string,
		occurrenceDate: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<{ id: string; authorizationId: string | null } | null> {
		const rows = await dbClient
			.select({
				id: leaveRequests.id,
				authorizationId:
					sql<string | null>`${leaveRequests.metadata} ->> 'authorizationId'`,
			})
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.studentId, studentId),
					eq(leaveRequests.leaveTypeId, leaveTypeId),
					sql`${leaveRequests.metadata} ->> 'occurrenceDate' = ${occurrenceDate}`,
					sql`${leaveRequests.metadata} ->> 'authorizationId' IS NOT NULL`,
					sql`${leaveRequests.status} NOT IN ('CANCELLED', 'REJECTED')`
				)
			)
			.limit(1);

		return rows[0] ?? null;
	},

	/** Occurrences already claimed under an authorization (usage history). */
	async findOccurrencesForAuthorization(
		authorizationId: string,
		dbClient: Pick<typeof db, "select"> = db
	) {
		return dbClient
			.select({ leave: leaveRequests })
			.from(leaveRequests)
			.where(
				and(
					sql`${leaveRequests.metadata} ->> 'authorizationId' = ${authorizationId}`,
					sql`${leaveRequests.status} NOT IN ('CANCELLED', 'REJECTED')`
				)
			)
			.orderBy(desc(leaveRequests.startAt));
	},

	/** Count of live occurrences claimed under the given authorizations. */
	async countOccurrences(
		authorizationIds: string[],
		dbClient: Pick<typeof db, "select"> = db
	): Promise<number> {
		if (authorizationIds.length === 0) return 0;

		const rows = await dbClient
			.select({ count: sql<number>`count(*)::int` })
			.from(leaveRequests)
			.where(
				and(
					inArray(
						sql`${leaveRequests.metadata} ->> 'authorizationId'`,
						authorizationIds
					),
					sql`${leaveRequests.status} NOT IN ('CANCELLED', 'REJECTED')`
				)
			);

		return rows[0]?.count ?? 0;
	},

	/**
	 * Earliest end-at among the student's live movement-bearing leaves —
	 * used by the claim guard to refuse claiming while an existing leave
	 * (e.g. a HOME_PASS) has the student out of hostel.
	 */
	async findEarliestLiveLeaveEnd(
		studentId: string,
		now: Date,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<Date | null> {
		const rows = await dbClient
			.select({ endAt: leaveRequests.endAt })
			.from(leaveRequests)
			.innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
			.where(
				and(
					eq(leaveRequests.studentId, studentId),
					eq(leaveRequests.status, LEAVE_REQUEST_STATUS.APPROVED),
					gte(leaveRequests.endAt, now),
					ne(leaveTypes.qrMode, "NONE")
				)
			)
			.orderBy(asc(leaveRequests.endAt))
			.limit(1);

		return rows[0]?.endAt ?? null;
	},
};
