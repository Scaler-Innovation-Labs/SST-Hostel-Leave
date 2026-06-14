import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { notificationLogs } from "@/db";
import { db } from "@/lib/db";

export type NotificationLog = InferSelectModel<typeof notificationLogs>;
export type NewNotificationLog = InferInsertModel<
	typeof notificationLogs
>;

type LogDbClient = Pick<typeof db, "select" | "insert">;

export type PaginatedNotifications = {
  items: NotificationLog[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const notificationLogRepository = {
	async create(
		input: NewNotificationLog,
		dbClient: LogDbClient = db
	): Promise<NotificationLog> {
		const rows = await dbClient
			.insert(notificationLogs)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async findById(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationLog | null> {
		const rows = await dbClient
			.select()
			.from(notificationLogs)
			.where(eq(notificationLogs.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByLeaveRequestId(
		leaveRequestId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationLog[]> {
		const rows = await dbClient
			.select()
			.from(notificationLogs)
			.where(eq(notificationLogs.leaveRequestId, leaveRequestId))
			.orderBy(desc(notificationLogs.createdAt));

		return rows;
	},

	async findByUserId(
		userId: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationLog[]> {
		const rows = await dbClient
			.select()
			.from(notificationLogs)
			.where(eq(notificationLogs.userId, userId))
			.orderBy(desc(notificationLogs.createdAt));

		return rows;
	},

	async findByUserIdPaginated(
		userId: string,
		page: number,
		limit: number,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<PaginatedNotifications> {
		const offset = (page - 1) * limit;

		const countResult = await dbClient
			.select({ count: sql<number>`count(*)` })
			.from(notificationLogs)
			.where(eq(notificationLogs.userId, userId));

		const total = Number(countResult[0]?.count ?? 0);    const unreadResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          isNull(notificationLogs.readAt),
        )
      );

		const unreadCount = Number(unreadResult[0]?.count ?? 0);

		const rows = await dbClient
			.select()
			.from(notificationLogs)
			.where(eq(notificationLogs.userId, userId))
			.orderBy(desc(notificationLogs.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			items: rows,
			total,
			unreadCount,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	},

	async markAsRead(
		ids: string[],
		dbClient: Pick<typeof db, "update"> = db
	): Promise<void> {
		if (ids.length === 0) return;
		await dbClient
			.update(notificationLogs)
			.set({ readAt: new Date() })
			.where(inArray(notificationLogs.id, ids));
	},
};
