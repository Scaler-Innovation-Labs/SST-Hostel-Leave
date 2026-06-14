import type { NotificationChannel } from "@/constants/notification/notification-channel";
import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import type { NotificationDeliveryStatus } from "@/constants/notification/notification-delivery-status";
import { NOTIFICATION_DELIVERY_STATUS } from "@/constants/notification/notification-delivery-status";
import type { NotificationEvent } from "@/constants/notification/notification-event";
import { notificationLogRepository } from "@/db/repositories/notification/notification-log.repository";
import { notificationRuleRepository } from "@/db/repositories/notification/notification-rule.repository";
import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";

import { createEmailProvider } from "./providers/email.provider";
import { createInAppProvider } from "./providers/in-app.provider";
import type { NotificationProvider, NotificationSendResult } from "./providers/notification-provider";
import { createSlackProvider } from "./providers/slack.provider";
import { createSmsProvider } from "./providers/sms.provider";

import type { NotificationRecipientType } from "@/constants/notification/notification-recipient-type";
import { NOTIFICATION_RECIPIENT_TYPE } from "@/constants/notification/notification-recipient-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { db } from "@/lib/db";
import { userRepository } from "@/db/repositories/auth/user.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import { roles as rolesTable, userRoles, users as usersTable } from "@/db/schema/auth";
import { leaveApprovals } from "@/db/schema/leave";
import { eq, inArray, and } from "drizzle-orm";

export type NotificationContext = {
	leaveRequestId?: string;
	leaveExtensionId?: string;
	leaveTypeId?: string;
	studentId?: string;
	userId?: string;
	parentId?: string;
	hostelId?: string;
	recipientEmail?: string;
	recipientPhone?: string;
	variables: Record<string, string>;
};

function resolveTemplate(
	templateBody: string,
	variables: Record<string, string>
): string {
	let resolved = templateBody;
	for (const [key, value] of Object.entries(variables)) {
		resolved = resolved.replace(
			new RegExp(`\\{\\{${key}\\}\\}`, "g"),
			value
		);
	}
	return resolved;
}

function getProvider(
	channel: NotificationChannel
): NotificationProvider | null {
	switch (channel) {
		case NOTIFICATION_CHANNEL.EMAIL:
			return createEmailProvider();
		case NOTIFICATION_CHANNEL.SMS:
			return createSmsProvider();
		case NOTIFICATION_CHANNEL.PUSH:
		case NOTIFICATION_CHANNEL.WEBHOOK:
			return createInAppProvider();
		case NOTIFICATION_CHANNEL.SLACK:
			return createSlackProvider();
		default:
			return null;
	}
}

async function resolveStudentContact(studentId: string): Promise<{ email?: string; phone?: string; userId?: string }> {
	const student = await studentRepository.findById(studentId);
	if (!student) return {};
	const user = await userRepository.findById(student.userId);
	if (!user) return {};
	return { email: user.email ?? undefined, phone: user.phone ?? undefined, userId: user.id };
}

async function findUsersByIds(ids: string[]): Promise<Array<{ id: string; email: string | null; phone: string | null }>> {
  if (ids.length === 0) return [];
  return db
    .select({ id: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
}

async function resolveRecipientContacts(
	recipientType: NotificationRecipientType,
	context: NotificationContext
): Promise<Array<{ email?: string; phone?: string; userId?: string; parentId?: string }>> {
	switch (recipientType) {
		case NOTIFICATION_RECIPIENT_TYPE.STUDENT: {
			if (context.recipientEmail || context.recipientPhone) {
				return [{ email: context.recipientEmail, phone: context.recipientPhone, userId: context.userId }];
			}
			if (context.studentId) {
				const contact = await resolveStudentContact(context.studentId);
				if (contact.email || contact.phone) return [contact];
			}
			return [];
		}

		case NOTIFICATION_RECIPIENT_TYPE.PARENT: {
			if (context.parentId) {
				const parent = await parentRepository.findById(context.parentId);
				if (parent) {
					return [{ email: parent.email ?? undefined, phone: parent.phone ?? undefined, parentId: parent.id }];
				}
			}
			if (context.studentId) {
				const parent = await parentRepository.findPrimaryByStudentId(context.studentId);
				if (parent) {
					return [{ email: parent.email ?? undefined, phone: parent.phone ?? undefined, parentId: parent.id }];
				}
			}
			return [];
		}

		case NOTIFICATION_RECIPIENT_TYPE.CURRENT_APPROVER: {
			if (!context.leaveRequestId) return [];
			const approvals = await db
				.select()
				.from(leaveApprovals)
				.where(eq(leaveApprovals.leaveRequestId, context.leaveRequestId))
				.orderBy(leaveApprovals.stepOrder);
			const pending = approvals.filter((a) => a.decision === LEAVE_APPROVAL_DECISION.PENDING);
			if (pending.length === 0) return [];
			const approverUserId = pending[0]!.approverUserId;
			if (!approverUserId) return [];
			const users = await findUsersByIds([approverUserId]);
			if (users.length === 0) return [];
			return [{ email: users[0]!.email ?? undefined, phone: users[0]!.phone ?? undefined, userId: users[0]!.id }];
		}

		case NOTIFICATION_RECIPIENT_TYPE.PREVIOUS_APPROVER: {
			if (!context.leaveRequestId) return [];
			const approvals = await db
				.select()
				.from(leaveApprovals)
				.where(eq(leaveApprovals.leaveRequestId, context.leaveRequestId))
				.orderBy(leaveApprovals.stepOrder);
			const decided = approvals.filter((a) => a.decision !== LEAVE_APPROVAL_DECISION.PENDING && a.approverUserId);
			const sorted = [...decided].sort((a, b) => b.stepOrder - a.stepOrder);
			if (sorted.length === 0) return [];
			const approverUserId = sorted[0]!.approverUserId!;
			const users = await findUsersByIds([approverUserId]);
			if (users.length === 0) return [];
			return [{ email: users[0]!.email ?? undefined, phone: users[0]!.phone ?? undefined, userId: users[0]!.id }];
		}

		case NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS: {
			if (!context.leaveRequestId) return [];
			const approvals = await db
				.select()
				.from(leaveApprovals)
				.where(eq(leaveApprovals.leaveRequestId, context.leaveRequestId));
			const userIds = approvals.map((a) => a.approverUserId).filter((id): id is string => id !== null);
			if (userIds.length === 0) return [];
			const users = await findUsersByIds(userIds);
			return users.map((u) => ({
				email: u.email ?? undefined,
				phone: u.phone ?? undefined,
				userId: u.id,
			}));
		}

		case NOTIFICATION_RECIPIENT_TYPE.WARDEN:
		case NOTIFICATION_RECIPIENT_TYPE.POC: {
			const hostelId = context.hostelId ?? null;
			if (!hostelId) return [];
			const roleCode = recipientType === NOTIFICATION_RECIPIENT_TYPE.WARDEN ? "WARDEN" : "POC";
			const roleRows = await db
				.select({ id: rolesTable.id })
				.from(rolesTable)
				.where(eq(rolesTable.code, roleCode));
			if (roleRows.length === 0) return [];
			const roleId = roleRows[0]!.id;
			const roleUserRows = await db
				.select({ userId: userRoles.userId })
				.from(userRoles)
				.where(eq(userRoles.roleId, roleId));
			if (roleUserRows.length === 0) return [];
			const roleUserIds = roleUserRows.map((r) => r.userId);
			const hostelUsers = await db
				.select({ id: usersTable.id, email: usersTable.email, phone: usersTable.phone })
				.from(usersTable)
				.where(and(inArray(usersTable.id, roleUserIds), eq(usersTable.hostelId, hostelId)));
			return hostelUsers.map((u) => ({ email: u.email ?? undefined, phone: u.phone ?? undefined, userId: u.id }));
		}

		case NOTIFICATION_RECIPIENT_TYPE.ADMIN:
		case NOTIFICATION_RECIPIENT_TYPE.SUPER_ADMIN: {
			const roleCode = recipientType === NOTIFICATION_RECIPIENT_TYPE.ADMIN ? "ADMIN" : "SUPER_ADMIN";
			const roleRows = await db
				.select({ id: rolesTable.id })
				.from(rolesTable)
				.where(eq(rolesTable.code, roleCode));
			if (roleRows.length === 0) return [];
			const roleId = roleRows[0]!.id;
			const roleUserRows = await db
				.select({ userId: userRoles.userId })
				.from(userRoles)
				.where(eq(userRoles.roleId, roleId));
			if (roleUserRows.length === 0) return [];
			const roleUserIds = roleUserRows.map((r) => r.userId);
			const adminUsers = await findUsersByIds(roleUserIds);
			return adminUsers.map((u) => ({
				email: u.email ?? undefined,
				phone: u.phone ?? undefined,
				userId: u.id,
			}));
		}

		default:
			return [];
	}
}

async function getRecipientForChannel(
	contact: { email?: string; phone?: string; userId?: string; parentId?: string },
	channel: NotificationChannel
): Promise<string | null> {
	switch (channel) {
		case NOTIFICATION_CHANNEL.EMAIL:
			return contact.email ?? null;
		case NOTIFICATION_CHANNEL.SMS:
			return contact.phone ?? null;
		case NOTIFICATION_CHANNEL.PUSH:
		case NOTIFICATION_CHANNEL.WEBHOOK:
			return contact.userId ?? null;
		case NOTIFICATION_CHANNEL.SLACK:
			return process.env.SLACK_CHANNEL_ID ?? "slack-channel";
		default:
			return null;
	}
}

async function deliverToRecipient(
	eventType: NotificationEvent,
	context: NotificationContext,
	template: { templateBody: string; subject: string | null },
	channel: NotificationChannel,
	recipient: string,
	userId?: string,
	parentId?: string,
): Promise<void> {
	const provider = getProvider(channel);
	if (!provider) return;

	const resolvedBody = resolveTemplate(template.templateBody, context.variables);
	const resolvedSubject = template.subject
		? resolveTemplate(template.subject, context.variables)
		: undefined;

	const result: NotificationSendResult = await provider.send({
		to: recipient,
		subject: resolvedSubject,
		body: resolvedBody,
		metadata: context.variables,
	});

	const deliveryStatus: NotificationDeliveryStatus = result.success
		? NOTIFICATION_DELIVERY_STATUS.SENT
		: NOTIFICATION_DELIVERY_STATUS.FAILED;

	await notificationLogRepository.create({
		leaveRequestId: context.leaveRequestId ?? null,
		leaveExtensionId: context.leaveExtensionId ?? null,
		userId: userId ?? context.userId ?? null,
		parentId: parentId ?? context.parentId ?? null,
		channel,
		eventType,
		recipient,
		deliveryStatus,
		providerResponse: result.error ?? null,
		providerMessageId: result.messageId ?? null,
		sentAt: result.success ? new Date() : null,
		metadata: context.variables,
	});
}

export const notificationService = {
	async notify(
		eventType: NotificationEvent,
		context: NotificationContext
	): Promise<{ success: boolean; failures: string[] }> {
		const failures: string[] = [];

		try {
			const rules = await notificationRuleRepository.findActiveByEvent(
				eventType,
				context.leaveTypeId,
			);

			if (rules.length === 0) {
				await this.notifyViaTemplates(eventType, context);
				return { success: true, failures };
			}

			for (const rule of rules) {
				const template = await notificationTemplateRepository.findById(rule.templateId);
				if (!template) continue;

				const resolvedChannels = rule.channels.map((c) => c.channel as NotificationChannel);

				for (const rType of rule.recipients) {
					const recipientType = rType.recipientType as NotificationRecipientType;
					const contacts = await resolveRecipientContacts(recipientType, context);

					for (const contact of contacts) {
						for (const channel of resolvedChannels) {
							const recipient = await getRecipientForChannel(contact, channel);
							if (!recipient) continue;

							try {
								await deliverToRecipient(
									eventType,
									context,
									template,
									channel,
									recipient,
									contact.userId,
									contact.parentId,
								);
							} catch (deliveryError) {
								const msg = `Failed to deliver ${channel} to ${recipient}: ${deliveryError instanceof Error ? deliveryError.message : String(deliveryError)}`;
								failures.push(msg);
							}
						}
					}
				}
			}
		} catch (error) {
			const msg = `Notification failed for ${eventType}: ${error instanceof Error ? error.message : String(error)}`;
			failures.push(msg);
		}

		return { success: failures.length === 0, failures };
	},

	async sendSms(to: string, body: string): Promise<void> {
		const provider = createSmsProvider();
		await provider.send({ to, body });
	},

	async notifyViaTemplates(
		eventType: NotificationEvent,
		context: NotificationContext
	): Promise<void> {
		const templates = await notificationTemplateRepository.findActiveByEventKey(eventType);
		if (templates.length === 0) return;

		for (const template of templates) {
			const channel = template.channel as NotificationChannel;
			const recipient = await getRecipientForChannel(
				{ email: context.recipientEmail, phone: context.recipientPhone, userId: context.userId },
				channel,
			);

			if (!recipient) continue;

			await deliverToRecipient(
				eventType,
				context,
				template,
				channel,
				recipient,
				context.userId,
				context.parentId,
			);
		}
	},
};
