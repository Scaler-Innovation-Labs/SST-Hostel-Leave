import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, asc, inArray } from "drizzle-orm";

import { notificationTemplates } from "@/db";
import { db } from "@/lib/db";

export type NotificationTemplate = InferSelectModel<
	typeof notificationTemplates
>;
export type NewNotificationTemplate = InferInsertModel<
	typeof notificationTemplates
>;

type TemplateDbClient = Pick<typeof db, "select" | "insert" | "update">;

export const notificationTemplateRepository = {
	async create(
		input: NewNotificationTemplate,
		dbClient: TemplateDbClient = db
	): Promise<NotificationTemplate> {
		const rows = await dbClient
			.insert(notificationTemplates)
			.values(input)
			.returning();

		return rows[0]!;
	},

	async list(
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationTemplate[]> {
		return dbClient
			.select()
			.from(notificationTemplates)
			.orderBy(asc(notificationTemplates.eventKey));
	},

	async findById(
		id: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationTemplate | null> {
		const rows = await dbClient
			.select()
			.from(notificationTemplates)
			.where(eq(notificationTemplates.id, id))
			.limit(1);

		return rows[0] ?? null;
	},

	async findByIds(
		ids: string[],
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationTemplate[]> {
		if (ids.length === 0) return [];
		return dbClient
			.select()
			.from(notificationTemplates)
			.where(inArray(notificationTemplates.id, ids));
	},

	async findByEventAndChannel(
		eventKey: string,
		channel: "EMAIL" | "SMS" | "PUSH" | "WEBHOOK" | "SLACK",
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationTemplate | null> {
		const rows = await dbClient
			.select()
			.from(notificationTemplates)
			.where(
				and(
					eq(notificationTemplates.eventKey, eventKey),
					eq(notificationTemplates.channel, channel),
					eq(notificationTemplates.isActive, true)
				)
			)
			.limit(1);

		return rows[0] ?? null;
	},

	async findActiveByEventKey(
		eventKey: string,
		dbClient: Pick<typeof db, "select"> = db
	): Promise<NotificationTemplate[]> {
		const rows = await dbClient
			.select()
			.from(notificationTemplates)
			.where(
				and(
					eq(notificationTemplates.eventKey, eventKey),
					eq(notificationTemplates.isActive, true)
				)
			);

		return rows;
	},

	async update(
		id: string,
		input: Partial<NewNotificationTemplate>,
		dbClient: TemplateDbClient = db
	): Promise<NotificationTemplate | null> {
		const rows = await dbClient
			.update(notificationTemplates)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(notificationTemplates.id, id))
			.returning();

		return rows[0] ?? null;
	},

	async delete(
		id: string,
		dbClient: Pick<typeof db, "delete"> = db
	): Promise<boolean> {
		const rows = await dbClient
			.delete(notificationTemplates)
			.where(eq(notificationTemplates.id, id))
			.returning({ id: notificationTemplates.id });

		return rows.length > 0;
	},
};
