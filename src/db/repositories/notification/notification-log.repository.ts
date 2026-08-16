import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { NotificationChannel } from "@/constants/notification/notification-channel";
import type { NotificationDeliveryStatus } from "@/constants/notification/notification-delivery-status";
import type { NotificationEvent } from "@/constants/notification/notification-event";
import { leaveRequests, notificationLogs, students, users } from "@/db";
import { db } from "@/lib/db";

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
  /** Restrict logs to these hostels (via leave → student → user). Empty = all. */
  hostelIds?: string[];
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
		if (filters.hostelIds?.length) {
			conditions.push(
				inArray(users.hostelId, filters.hostelIds)
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Notification logs have no hostel column — scope them via the leave
		// → student → user chain (the log's leaveRequestId is the source).
		const baseQuery = dbClient
			.select()
			.from(notificationLogs)
			.leftJoin(leaveRequests, eq(notificationLogs.leaveRequestId, leaveRequests.id))
			.leftJoin(students, eq(leaveRequests.studentId, students.id))
			.leftJoin(users, eq(students.userId, users.id))
			.where(whereClause);

		const countResult = await dbClient
			.select({ count: sql<number>`count(*)` })
			.from(notificationLogs)
			.leftJoin(leaveRequests, eq(notificationLogs.leaveRequestId, leaveRequests.id))
			.leftJoin(students, eq(leaveRequests.studentId, students.id))
			.leftJoin(users, eq(students.userId, users.id))
			.where(whereClause);

		const total = Number(countResult[0]?.count ?? 0);
		const offset = (filters.page - 1) * filters.limit;

		const rows = await baseQuery
			.orderBy(desc(notificationLogs.createdAt))
			.limit(filters.limit)
			.offset(offset);

		return {
			items: rows.map((row) => row.notification_logs),
			total,
			page: filters.page,
			limit: filters.limit,
			totalPages: Math.ceil(total / filters.limit),
		};
	},
};
