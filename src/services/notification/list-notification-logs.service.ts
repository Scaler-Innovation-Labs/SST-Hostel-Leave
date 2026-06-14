import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { notificationLogs } from "@/db";
import { db } from "@/lib/db";
import type { ListNotificationLogsQuery } from "@/dto/notification/list-notification-logs.dto";
import type { NotificationEvent } from "@/constants/notification/notification-event";
import type { NotificationChannel } from "@/constants/notification/notification-channel";
import type { NotificationDeliveryStatus } from "@/constants/notification/notification-delivery-status";

export async function listNotificationLogs(query: ListNotificationLogsQuery) {
  const conditions: ReturnType<typeof and>[] = [];

  if (query.eventType) {
    conditions.push(eq(notificationLogs.eventType, query.eventType as NotificationEvent));
  }
  if (query.channel) {
    conditions.push(eq(notificationLogs.channel, query.channel as NotificationChannel));
  }
  if (query.status) {
    conditions.push(eq(notificationLogs.deliveryStatus, query.status as NotificationDeliveryStatus));
  }
  if (query.dateFrom) {
    conditions.push(gte(notificationLogs.createdAt, new Date(query.dateFrom)));
  }
  if (query.dateTo) {
    conditions.push(lte(notificationLogs.createdAt, new Date(query.dateTo)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationLogs)
    .where(whereClause);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / query.limit);
  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select()
    .from(notificationLogs)
    .where(whereClause)
    .orderBy(desc(notificationLogs.createdAt))
    .limit(query.limit)
    .offset(offset);

  return {
    items: rows,
    total,
    page: query.page,
    limit: query.limit,
    totalPages,
  };
}
