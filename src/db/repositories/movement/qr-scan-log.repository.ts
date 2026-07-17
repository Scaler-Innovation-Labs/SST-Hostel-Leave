import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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

};

export default qrScanLogRepository;
