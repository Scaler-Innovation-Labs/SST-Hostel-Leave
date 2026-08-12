import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";

import { QR_STATUS } from "@/constants/movement/qr-status";
import type { QrType } from "@/constants/movement/qr-type";
import { hostels, leaveRequests, leaveTypes, qrPasses, students, users } from "@/db";
import { db } from "@/lib/db";

export type QrPass = InferSelectModel<typeof qrPasses>;
export type NewQrPass = InferInsertModel<typeof qrPasses>;

type QrPassDbClient = Pick<typeof db, "insert" | "select" | "update">;

export const qrPassRepository = {
	async create(
		input: NewQrPass,
		dbClient: QrPassDbClient = db
	): Promise<QrPass> {
		const rows = await dbClient
			.insert(qrPasses)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async regenerate(
		id: string,
		input: {
			tokenHash: string;
			qrType: QrType;
			expiresAt: Date | null;
			/** New raw pass token — replaces the old one (only used to repair legacy passes). */
			token?: string;
		},
		dbClient: QrPassDbClient = db
	): Promise<QrPass> {
		const setData: Partial<NewQrPass> = {
			tokenHash: input.tokenHash,
			qrType: input.qrType,
			status: QR_STATUS.ACTIVE,
			expiresAt: input.expiresAt,
			generatedAt: new Date(),
			firstScanAt: null,
			closedAt: null,
			invalidatedAt: null,
		};

		if (input.token) {
			setData.token = input.token;
		}

		const rows = await dbClient
			.update(qrPasses)
			.set(setData)
			.where(eq(qrPasses.id, id))
			.returning();

		return rows[0]!;
	},

	async findById(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.select()
			.from(qrPasses)
			.where(eq(qrPasses.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByLeaveRequestId(
		leaveRequestId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.select()
			.from(qrPasses)
			.where(eq(qrPasses.leaveRequestId, leaveRequestId))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByStudentId(
		studentId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<QrPass[]> {
		const rows = await dbClient
			.select()
			.from(qrPasses)
			.where(eq(qrPasses.studentId, studentId));

		return rows;
	},

	async findByTokenHash(
		tokenHash: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.select()
			.from(qrPasses)
			.where(eq(qrPasses.tokenHash, tokenHash))
			.limit(1);

		return rows[0] ?? null;
	},



	async updateStatus(
		id: string,
		status: QrPass["status"],
		dbClient: Pick<typeof db, "update"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.update(qrPasses)
			.set({ status })
			.where(eq(qrPasses.id, id))
			.returning();

		return rows[0] ?? null;
	},

	async markAsFirstScanned(
		id: string,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.update(qrPasses)
			.set({
				firstScanAt: new Date(),
			})
			.where(eq(qrPasses.id, id))
			.returning();

		return rows[0] ?? null;
	},

	async markAsClosed(
		id: string,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.update(qrPasses)
			.set({
				closedAt: new Date(),
				status: QR_STATUS.USED,
			})
			.where(eq(qrPasses.id, id))
			.returning();

		return rows[0] ?? null;
	},

	async invalidate(
		id: string,
		dbClient: Pick<typeof db, "update"> = db
	): Promise<QrPass | null> {
		const rows = await dbClient
			.update(qrPasses)
			.set({
				invalidatedAt: new Date(),
				status: QR_STATUS.INVALIDATED,
			})
			.where(eq(qrPasses.id, id))
			.returning();

		return rows[0] ?? null;
  },

  async findExpired(
    before: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<QrPass[]> {
    const rows = await dbClient
      .select()
      .from(qrPasses)
      .where(
        and(
          eq(qrPasses.status, QR_STATUS.ACTIVE),
          lte(qrPasses.expiresAt, before)
        )
      );

    return rows;
  },

  /**
   * Overdue returns: the student checked out (pass first-scanned) but never
   * checked back in (pass not closed) and the leave duration has ended.
   * Scoped to the given hostels for staff roles.
   */
  async findOverdueReturns(
    opts: { hostelIds?: string[]; limit?: number; offset?: number } = {},
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<
    Array<{
      id: string;
      leaveRequestId: string;
      studentId: string;
      qrType: string;
      status: string;
      firstScanAt: Date | null;
      closedAt: Date | null;
      generatedAt: Date;
      expiresAt: Date | null;
      studentName: string | null;
      studentRollNumber: string | null;
      roomNumber: string | null;
      hostelId: string | null;
      hostelName: string | null;
      leaveTypeName: string | null;
      requestNumber: string | null;
      leaveStartAt: Date | null;
      leaveEndAt: Date | null;
    }>
  > {
    const conditions: ReturnType<typeof and>[] = [
      isNotNull(qrPasses.firstScanAt),
      isNull(qrPasses.closedAt),
      lt(leaveRequests.endAt, new Date()),
    ];
    if (opts.hostelIds?.length) {
      conditions.push(inArray(users.hostelId, opts.hostelIds));
    }

    // Explicit columns only: the live DB predates migrate-0010 and has no
    // qr_passes.token, so selecting the whole table would fail there.
    const rows = await dbClient
      .select({
        id: qrPasses.id,
        leaveRequestId: qrPasses.leaveRequestId,
        studentId: qrPasses.studentId,
        qrType: qrPasses.qrType,
        status: qrPasses.status,
        firstScanAt: qrPasses.firstScanAt,
        closedAt: qrPasses.closedAt,
        generatedAt: qrPasses.generatedAt,
        expiresAt: qrPasses.expiresAt,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
        roomNumber: students.roomNumber,
        hostelId: users.hostelId,
        hostelName: hostels.name,
        leaveTypeName: leaveTypes.name,
        requestNumber: leaveRequests.requestNumber,
        leaveStartAt: leaveRequests.startAt,
        leaveEndAt: leaveRequests.endAt,
      })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(students, eq(qrPasses.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .where(and(...conditions))
      .orderBy(asc(leaveRequests.endAt))
      .limit(opts.limit ?? 200)
      .offset(opts.offset ?? 0);

    return rows;
  },

  async countActive(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [eq(qrPasses.status, QR_STATUS.ACTIVE)];
    if (hostelIds?.length) {
      conditions.push(inArray(users.hostelId, hostelIds));
    }
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async countAll(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [];
    if (hostelIds?.length) {
      conditions.push(inArray(users.hostelId, hostelIds));
    }
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },
};

export default qrPassRepository;
