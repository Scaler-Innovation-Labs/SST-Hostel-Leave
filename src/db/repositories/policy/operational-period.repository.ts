import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import { operationalPeriods } from "@/db";
import { db } from "@/lib/db";

export type OperationalPeriod = InferSelectModel<typeof operationalPeriods>;

type OperationalPeriodDbClient = Pick<typeof db, "select">;

export const operationalPeriodRepository = {
	async findOverlapping(
		periodTypes: string[],
		startAt: Date,
		endAt: Date,
		hostelId: string | null = null,
		dbClient: OperationalPeriodDbClient = db
	): Promise<OperationalPeriod[]> {
		const rows = await dbClient
			.select()
			.from(operationalPeriods)
			.where(
				and(
					eq(operationalPeriods.isActive, true),
					hostelId
						? or(eq(operationalPeriods.hostelId, hostelId), isNull(operationalPeriods.hostelId))
						: isNull(operationalPeriods.hostelId),
					or(
						...periodTypes.map((type) =>
							eq(operationalPeriods.periodType, type)
						)
					),
					lte(operationalPeriods.startDate, endAt),
					gte(operationalPeriods.endDate, startAt)
				)
			)
			.limit(1);

		return rows;
	},
};

export default operationalPeriodRepository;
