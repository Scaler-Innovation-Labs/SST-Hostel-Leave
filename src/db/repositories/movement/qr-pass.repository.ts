import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, lte, sql } from "drizzle-orm";

import { QR_STATUS } from "@/constants/movement/qr-status";
import type { QrType } from "@/constants/movement/qr-type";
import { qrPasses } from "@/db";
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
		},
		dbClient: QrPassDbClient = db
	): Promise<QrPass> {
		const rows = await dbClient
			.update(qrPasses)
			.set({
				tokenHash: input.tokenHash,
				qrType: input.qrType,
				status: QR_STATUS.ACTIVE,
				expiresAt: input.expiresAt,
				generatedAt: new Date(),
				firstScanAt: null,
				closedAt: null,
				invalidatedAt: null,
			})
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

  async countActive(
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(qrPasses)
      .where(eq(qrPasses.status, QR_STATUS.ACTIVE));
    return Number(result[0]?.count ?? 0);
  },
};

export default qrPassRepository;
