import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { movementStates } from "@/db";
import { db } from "@/lib/db";

export type MovementStateRecord = InferSelectModel<
	typeof movementStates
>;

type MovementStateDbClient = Pick<typeof db, "select">;

export const movementStateRepository = {
	async findByCode(
		code: string,
		dbClient: MovementStateDbClient = db
	): Promise<MovementStateRecord | null> {
		const rows = await dbClient
			.select()
			.from(movementStates)
			.where(eq(movementStates.code, code))
			.limit(1);

		return rows[0] ?? null;
	},

	async findAll(
		dbClient: MovementStateDbClient = db
	): Promise<MovementStateRecord[]> {
		const rows = await dbClient
			.select()
			.from(movementStates);

		return rows;
	},
};

export default movementStateRepository;
