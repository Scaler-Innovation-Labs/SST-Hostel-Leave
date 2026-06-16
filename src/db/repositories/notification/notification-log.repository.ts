import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { notificationLogs } from "@/db";
import { db } from "@/lib/db";
import type { NotificationChannel } from "@/constants/notification/notification-channel";
import type { NotificationDeliveryStatus } from "@/constants/notification/notification-delivery-status";
import type { NotificationEvent } from "@/constants/notification/notification-event";

export type NotificationLog = InferSelectModel<typeof notificationLogs>;
export type NewNotificationLog = InferInsertModel<
	typeof notificationLogs
>;

export type NotificationLogFilters = {
  eventType?: string;
  channel?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
};

export type PaginatedLogs = {
  items: NotificationLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

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

	async findByFilters(
		filters: NotificationLogFilters,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<PaginatedLogs> {
		const conditions: ReturnType<typeof and>[] = [];

		if (filters.eventType) {
			conditions.push(eq(notificationLogs.eventType, filters.eventType as NotificationEvent));
		}
		if (filters.channel) {
			conditions.push(eq(notificationLogs.channel, filters.channel as NotificationChannel));
		}
		if (filters.status) {
			conditions.push(eq(notificationLogs.deliveryStatus, filters.status as NotificationDeliveryStatus));
		}
		if (filters.dateFrom) {
			conditions.push(gte(notificationLogs.createdAt, new Date(filters.dateFrom)));
		}
		if (filters.dateTo) {
			conditions.push(lte(notificationLogs.createdAt, new Date(filters.dateTo)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const countResult = await dbClient
			.select({ count: sql<number>`count(*)` })
			.from(notificationLogs)
			.where(whereClause);

		const total = Number(countResult[0]?.count ?? 0);
		const offset = (filters.page - 1) * filters.limit;

		const rows = await dbClient
			.select()
			.from(notificationLogs)
			.where(whereClause)
			.orderBy(desc(notificationLogs.createdAt))
			.limit(filters.limit)
			.offset(offset);

		return {
			items: rows,
			total,
			page: filters.page,
			limit: filters.limit,
			totalPages: Math.ceil(total / filters.limit),
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
