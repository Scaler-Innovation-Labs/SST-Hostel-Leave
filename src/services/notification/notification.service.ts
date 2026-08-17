import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import type { NotificationChannel } from "@/constants/notification/notification-channel";
import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_DELIVERY_STATUS } from "@/constants/notification/notification-delivery-status";
import type { NotificationEvent } from "@/constants/notification/notification-event";
import type { NotificationRecipientType } from "@/constants/notification/notification-recipient-type";
import { NOTIFICATION_RECIPIENT_TYPE } from "@/constants/notification/notification-recipient-type";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { hostelRepository } from "@/db/repositories/hostel/hostel.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { notificationLogRepository } from "@/db/repositories/notification/notification-log.repository";
import { notificationRuleRepository } from "@/db/repositories/notification/notification-rule.repository";
import type { NotificationTemplate } from "@/db/repositories/notification/notification-template.repository";
import { notificationTemplateRepository } from "@/db/repositories/notification/notification-template.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { ROLES } from "@/lib/auth/roles";

import { createEmailProvider } from "./providers/email.provider";
import { createInAppProvider } from "./providers/in-app.provider";
import type { NotificationProvider, NotificationSendResult } from "./providers/notification-provider";
import { createSlackProvider } from "./providers/slack.provider";
import { createSmsProvider } from "./providers/sms.provider";

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
	templateCode?: string;
	/** Emails to CC on emails dispatched for this event. */
	cc?: string[];
	variables: Record<string, string>;
};

/**
 * Variable keys that carry bearer credentials and must never be persisted
 * into notification_logs.metadata: parent-approval links embed the raw
 * 64-hex consent token, and qrCodeUrl is a QR data-URI encoding the raw
 * pass token. Anything else in context.variables is safe to keep for audit.
 */
const SENSITIVE_METADATA_KEYS: ReadonlySet<string> = new Set([
	"approvalLink",
	"qrCodeUrl",
	"qrToken",
]);

function isSensitiveMetadataKey(key: string): boolean {
	return SENSITIVE_METADATA_KEYS.has(key) || /token|secret/i.test(key);
}

/** Drops credential-bearing entries from a variables map before logging. */
function sanitizeLogMetadata(
	variables: Record<string, string>
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(variables).filter(
			([key]) => !isSensitiveMetadataKey(key)
		)
	);
}

/**
 * HTML-escapes a single template variable value. Used for the email HTML
 * body render — template-authored markup (the QR <img>, <a>, <strong> tags)
 * must survive raw, while user-supplied values (reason, names, URLs) are
 * escaped so a reason like "<script>" or "A & B" cannot inject markup.
 */
function escapeHtmlValue(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function resolveTemplate(
	templateBody: string,
	variables: Record<string, string>,
	options: { escapeHtml?: boolean } = {}
): string {
	let resolved = templateBody;
	for (const [key, value] of Object.entries(variables)) {
		// Function replacer (not a string): a string replacement interprets
		// $-sequences ($&, $', $` …) inside the value, so a reason or name
		// containing "$" would be corrupted. Keys are trusted template
		// placeholders; values are user-supplied data.
		resolved = resolved.replace(
			new RegExp(`\\{\\{${key}\\}\\}`, "g"),
			() => (options.escapeHtml ? escapeHtmlValue(value) : value)
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
			const approvals = await leaveApprovalRepository.findByLeaveRequestId(context.leaveRequestId);
			const pending = approvals.filter((a) => a.decision === LEAVE_APPROVAL_DECISION.PENDING);
			if (pending.length === 0) return [];
			const approverUserId = pending[0]!.approverUserId;
			if (!approverUserId) return [];
			const users = await userRepository.findByIds([approverUserId]);
			return users.length > 0
				? [{ email: users[0]!.email ?? undefined, phone: users[0]!.phone ?? undefined, userId: users[0]!.id }]
				: [];
		}

		case NOTIFICATION_RECIPIENT_TYPE.PREVIOUS_APPROVER: {
			if (!context.leaveRequestId) return [];
			const approvals = await leaveApprovalRepository.findByLeaveRequestId(context.leaveRequestId);
			const decided = approvals.filter((a): a is typeof a & { approverUserId: string } => a.decision !== LEAVE_APPROVAL_DECISION.PENDING && a.approverUserId !== null);
			const sorted = [...decided].sort((a, b) => b.stepOrder - a.stepOrder);
			if (sorted.length === 0) return [];
			const approverUserId = sorted[0]!.approverUserId;
			const users = await userRepository.findByIds([approverUserId]);
			return users.length > 0
				? [{ email: users[0]!.email ?? undefined, phone: users[0]!.phone ?? undefined, userId: users[0]!.id }]
				: [];
		}

		case NOTIFICATION_RECIPIENT_TYPE.ALL_APPROVERS: {
			if (!context.leaveRequestId) return [];
			const approvals = await leaveApprovalRepository.findByLeaveRequestId(context.leaveRequestId);
			const userIds = approvals.map((a) => a.approverUserId).filter((id): id is string => id !== null);
			if (userIds.length === 0) return [];
			const users = await userRepository.findByIds(userIds);
			return users.map((u) => ({
				email: u.email ?? undefined,
				phone: u.phone ?? undefined,
				userId: u.id,
			}));
		}

		case NOTIFICATION_RECIPIENT_TYPE.POC: {
			// POC alerts are not scoped — every POC-role user is a recipient
			// regardless of the hostel the leave belongs to.
			const roleUserIds = await userRoleRepository.findUserIdsByRoleCode(ROLES.POC);
			if (roleUserIds.length === 0) return [];
			const pocUsers = await userRepository.findByIds(roleUserIds);
			return pocUsers.map((u) => ({
				email: u.email ?? undefined,
				phone: u.phone ?? undefined,
				userId: u.id,
			}));
		}

		case NOTIFICATION_RECIPIENT_TYPE.WARDEN: {
			const hostelId = context.hostelId ?? null;
			if (!hostelId) return [];
			const roleUserIds = await userRoleRepository.findUserIdsByRoleCode("WARDEN");
			if (roleUserIds.length === 0) return [];
			const hostelUsers = await userRepository.findByIds(roleUserIds);
			return hostelUsers
				// A warden without a hostel assignment (hostelId null) is
				// unrestricted and receives alerts for every hostel.
				.filter((u) => !u.hostelId || u.hostelId === hostelId)
				.map((u) => ({ email: u.email ?? undefined, phone: u.phone ?? undefined, userId: u.id }));
		}

		case NOTIFICATION_RECIPIENT_TYPE.ADMIN:
		case NOTIFICATION_RECIPIENT_TYPE.SUPER_ADMIN: {
			const roleCode = recipientType === NOTIFICATION_RECIPIENT_TYPE.ADMIN ? ROLES.ADMIN : ROLES.SUPER_ADMIN;
			const roleUserIds = await userRoleRepository.findUserIdsByRoleCode(roleCode);
			if (roleUserIds.length === 0) return [];
			const adminUsers = await userRepository.findByIds(roleUserIds);
			return adminUsers.map((u) => ({
				email: u.email ?? undefined,
				phone: u.phone ?? undefined,
				userId: u.id,
			}));
		}

		case NOTIFICATION_RECIPIENT_TYPE.HOSTEL_ADMIN: {
			const hostelId = context.hostelId ?? null;
			if (!hostelId) return [];
			const roleUserIds = await userRoleRepository.findUserIdsByRoleCode(ROLES.ADMIN);
			if (roleUserIds.length === 0) return [];
			const adminUsers = await userRepository.findByIds(roleUserIds);
			return adminUsers
				// An admin without a hostel assignment (hostelId null) is
				// unrestricted and receives alerts for every hostel.
				.filter((u) => !u.hostelId || u.hostelId === hostelId)
				.map((u) => ({
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
	contact: { type?: NotificationRecipientType; email?: string; phone?: string; userId?: string; parentId?: string },
	channel: NotificationChannel,
	hostelId?: string,
	/** Pre-resolved hostel Slack channel id — avoids an N+1 hostel lookup when
	 *  resolving many contacts for the same hostel. */
	resolvedHostelSlackChannelId?: string | null,
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
			// POC-targeted alerts post to their own channel (SLACK_POC_CHANNEL_ID),
			// falling back to the main channel when unset.
			if (contact.type === NOTIFICATION_RECIPIENT_TYPE.POC) {
				return process.env.SLACK_POC_CHANNEL_ID || process.env.SLACK_CHANNEL_ID || "slack-channel";
			}
			// Admin/staff alerts follow the hostel's own Slack channel when one is
			// configured on the hostel, falling back to the global SLACK_CHANNEL_ID.
			if (resolvedHostelSlackChannelId) return resolvedHostelSlackChannelId;
			if (hostelId) {
				const hostel = await hostelRepository.findById(hostelId);
				if (hostel?.slackChannelId) return hostel.slackChannelId;
			}
			// "slack-channel" is a sentinel meaning "no channel configured" — the
			// provider stubs out when the env fallback is also missing.
			return process.env.SLACK_CHANNEL_ID || "slack-channel";
		default:
			return null;
	}
}

/**
 * Slack ids to CC on messages tied to a hostel: the hostel's admin user
 * group (configured on the hostel). Empty when unset.
 */
async function resolveSlackMentions(hostelId?: string): Promise<string[]> {
	if (!hostelId) return [];
	const hostel = await hostelRepository.findById(hostelId);
	if (!hostel) return [];
	return [hostel.slackAdminGroupId].filter(
		(id): id is string => !!id && id.length > 0
	);
}

async function deliverToRecipient(
	eventType: NotificationEvent,
	context: NotificationContext,
	template: NotificationTemplate,
	channel: NotificationChannel,
	recipient: string | string[],
	userId?: string,
	parentId?: string,
): Promise<void> {
	const provider = getProvider(channel);
	if (!provider) return;

	const resolvedBody = resolveTemplate(template.templateBody, context.variables);
	// The email HTML body escapes user-supplied values (template-authored
	// markup like the QR <img> survives raw); the plain-text body keeps raw
	// values so SMS/plain-text recipients never see &amp; / &lt; entities.
	const resolvedHtmlBody =
		channel === NOTIFICATION_CHANNEL.EMAIL
			? resolveTemplate(template.templateBody, context.variables, {
					escapeHtml: true,
			  })
			: undefined;
	const resolvedSubject = template.subject
		? resolveTemplate(template.subject, context.variables)
		: undefined;

	const providerMetadata: Record<string, unknown> | undefined =
		(template.metadata as { providerMetadata?: Record<string, unknown> })?.providerMetadata;

	const mentions =
		channel === NOTIFICATION_CHANNEL.SLACK
			? await resolveSlackMentions(context.hostelId)
			: [];

	const cc =
		channel === NOTIFICATION_CHANNEL.EMAIL && context.cc && context.cc.length > 0
			? context.cc
			: undefined;

	const result: NotificationSendResult = await provider.send({
		to: recipient,
		subject: resolvedSubject,
		body: resolvedBody,
		htmlBody: resolvedHtmlBody,
		metadata: context.variables,
		templateCode: template.code,
		providerMetadata,
		mentions,
		cc,
	});

	// Credentials (parent approval links, QR data-URIs) must not be persisted
	// at rest in notification_logs.metadata — strip them before writing.
	const logMetadata: Record<string, string> = sanitizeLogMetadata(
		context.variables
	);
	if (mentions.length > 0) logMetadata.slackMentions = mentions.join(", ");

	await notificationLogRepository.create({
		leaveRequestId: context.leaveRequestId ?? null,
		leaveExtensionId: context.leaveExtensionId ?? null,
		userId: userId ?? context.userId ?? null,
		parentId: parentId ?? context.parentId ?? null,
		channel,
		eventType,
		recipient: Array.isArray(recipient) ? recipient.join(", ") : recipient,
		ccRecipients: cc ?? null,
		deliveryStatus: result.success
			? NOTIFICATION_DELIVERY_STATUS.SENT
			: NOTIFICATION_DELIVERY_STATUS.FAILED,
		providerResponse: result.error ?? null,
		providerMessageId: result.messageId ?? null,
		sentAt: result.success ? new Date() : null,
		metadata: logMetadata,
	});

	// A provider that reports failure (as opposed to throwing) must still
	// surface as a failed delivery — otherwise notify() records success and
	// the outbox marks the event PROCESSED even though nothing was sent.
	// Throwing here lets the per-channel try/catch in notify() collect it
	// into the failures list so the event is retried.
	if (!result.success) {
		throw new Error(
			`Provider reported delivery failure: ${result.error ?? "unknown error"}`
		);
	}
}

export const notificationService = {
	async notify(
		eventType: NotificationEvent,
		context: NotificationContext
	): Promise<{ success: boolean; failures: string[] }> {
		const failures: string[] = [];

		try {
			if (context.templateCode) {
				const template = await notificationTemplateRepository.findByCode(context.templateCode);
				if (template) {
					const channel = template.channel as NotificationChannel;
					const recipient = await getRecipientForChannel(
						{ email: context.recipientEmail, phone: context.recipientPhone, userId: context.userId },
						channel,
						context.hostelId,
					);
					if (recipient) {
						await deliverToRecipient(eventType, context, template, channel, recipient, context.userId, context.parentId);
					}
				}
				return { success: true, failures };
			}

			const rules = await notificationRuleRepository.findActiveByEvent(
				eventType,
				context.leaveTypeId,
			);

			// Rule-driven only — no fallback. If nothing is configured for this
			// event + leave type, nothing is sent (this prevents sending every
			// matching template for the event, which duplicated parent SMS).
			if (rules.length === 0) {
				return { success: true, failures };
			}

			const templateIds = [...new Set(rules.map((r) => r.templateId))];
			const templates = await notificationTemplateRepository.findByIds(templateIds);
			const templateById = new Map(templates.map((t) => [t.id, t]));

			for (const rule of rules) {
				const template = templateById.get(rule.templateId);
				if (!template) continue;

				const resolvedChannels = rule.channels.map((c) => c.channel as NotificationChannel);

				// Resolve all recipient contacts for this rule
				const recipientTypes = rule.recipients.map((r) => r.recipientType as NotificationRecipientType);
				const allContacts: Array<{ type: NotificationRecipientType; email?: string; phone?: string; userId?: string; parentId?: string }> = [];
				for (const rType of recipientTypes) {
					const contacts = await resolveRecipientContacts(rType, context);
					for (const c of contacts) {
						allContacts.push({ type: rType, ...c });
					}
				}

				for (const channel of resolvedChannels) {
					// For email: batch all recipients into one send (student + parent get the same email)
					if (channel === NOTIFICATION_CHANNEL.EMAIL) {
						const emailAddresses = allContacts
							.filter((c) => c.email)
							.map((c) => c.email!);
						const uniqueEmails = [...new Set(emailAddresses)];
						if (uniqueEmails.length === 0) continue;

						try {
							const primaryContact = allContacts.find((c) => c.userId) ?? allContacts[0]!;
							await deliverToRecipient(
								eventType,
								context,
								template,
								channel,
								uniqueEmails,
								primaryContact.userId,
								primaryContact.parentId,
							);
						} catch (deliveryError) {
							const msg = `Failed to deliver ${channel} to ${uniqueEmails.join(", ")}: ${deliveryError instanceof Error ? deliveryError.message : String(deliveryError)}`;
							failures.push(msg);
						}
						continue;
					}

					// Slack: the recipient is a channel, so multiple contacts (e.g.
					// several admins/POCs) must not produce duplicate posts — send
					// exactly one message per unique channel.
					if (channel === NOTIFICATION_CHANNEL.SLACK) {
						// All non-POC contacts share the hostel's channel — resolve it
						// once instead of once per contact (N+1 on a multi-admin hostel).
						const hostel = context.hostelId
							? await hostelRepository.findById(context.hostelId)
							: null;
						const resolvedHostelSlackChannelId =
							hostel?.slackChannelId ?? null;

						const channels = [
							...new Set(
								(
									await Promise.all(
										allContacts.map((c) =>
											getRecipientForChannel(
												c,
												channel,
												context.hostelId,
												resolvedHostelSlackChannelId,
											)
										)
									)
								).filter((r): r is string => !!r)
							),
						];

						for (const recipient of channels) {
							try {
								const primaryContact =
									allContacts.find((c) => c.userId) ?? allContacts[0];
								await deliverToRecipient(
									eventType,
									context,
									template,
									channel,
									recipient,
									primaryContact?.userId,
									primaryContact?.parentId,
								);
							} catch (deliveryError) {
								const msg = `Failed to deliver ${channel} to ${recipient}: ${deliveryError instanceof Error ? deliveryError.message : String(deliveryError)}`;
								failures.push(msg);
							}
						}
						continue;
					}

					// Other non-email channels (per-user): send individually
					for (const contact of allContacts) {
						const recipient = await getRecipientForChannel(contact, channel, context.hostelId);
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
		} catch (error) {
			const msg = `Notification failed for ${eventType}: ${error instanceof Error ? error.message : String(error)}`;
			failures.push(msg);
		}

		return { success: failures.length === 0, failures };
	},
};
