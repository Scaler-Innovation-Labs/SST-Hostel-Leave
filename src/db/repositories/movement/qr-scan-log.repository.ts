import { and, eq, gte, type InferInsertModel, type InferSelectModel, lte } from "drizzle-orm";

import { qrScanLogs } from "@/db";
import { db } from "@/lib/db";

export type QrScanLog = InferSelectModel<typeof qrScanLogs>;
export type NewQrScanLog = InferInsertModel<typeof qrScanLogs>;

type QrScanLogDbClient = Pick<typeof db, "insert" | "select">;

export const qrScanLogRepository = {
	async create(
		input: NewQrScanLog,
		dbClient: QrScanLogDbClient = db
	): Promise<QrScanLog> {
		const rows = await dbClient
			.insert(qrScanLogs)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async countTodaySuccessfulScans(
		qrPassId: string,
		from: Date,
		to: Date,
		dbClient: QrScanLogDbClient = db
	): Promise<{ exitCount: number; returnCount: number; totalCount: number }> {
		const rows = await dbClient
			.select({
				scanType: qrScanLogs.scanType,
			})
			.from(qrScanLogs)
			.where(
				and(
					eq(qrScanLogs.qrPassId, qrPassId),
					eq(qrScanLogs.scanResult, "SUCCESS"),
					gte(qrScanLogs.scannedAt, from),
					lte(qrScanLogs.scannedAt, to)
				)
			);

		let exitCount = 0;
		let returnCount = 0;
		for (const row of rows) {
			if (row.scanType === "EXIT_SCAN") exitCount++;
			if (row.scanType === "RETURN_SCAN") returnCount++;
		}
		return { exitCount, returnCount, totalCount: exitCount + returnCount };
	},
};

export default qrScanLogRepository;
