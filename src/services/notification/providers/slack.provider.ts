import type { Block, KnownBlock } from "@slack/web-api";

import { logger } from "@/lib/logger";

import type {
	NotificationPayload,
	NotificationSendResult,
} from "./notification-provider";

/**
 * Slack mention syntax differs by target:
 * - User ids (U...) mention the member: <@U123>
 * - Usergroup ids (S...) mention the whole group: <!subteam^S123>
 */
function formatSlackMention(id: string): string {
	if (id.startsWith("S")) return `<!subteam^${id}>`;
	if (id.startsWith("U")) return `<@${id}>`;
	return `@${id}`;
}

/**
 * Neutralizes mrkdwn control sequences in user-supplied values pasted into
 * message text. `&`, `<`, `>` delimit mentions, channel broadcasts
 * (`<!channel>`), and link markup (`<url|text>`) — encoding them keeps a
 * leave reason like "<!channel> approve: http://evil" inert inside the
 * trusted hostel/admin channel. Server-formatted mentions above bypass
 * this intentionally (they are allowlisted ids, not user input).
 */
function escapeSlackText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function createSlackProvider() {
	return {
		async send(
			payload: NotificationPayload
		): Promise<NotificationSendResult> {
			const botToken = process.env.SLACK_BOT_TOKEN;
			// `to` carries the target Slack channel (the notification service
			// resolves the main vs POC channel). "slack-channel" is the legacy
			// sentinel used by the settings-page test sender to mean "use the
			// default channel" — fall back to SLACK_CHANNEL_ID for it.
			const channelId =
				typeof payload.to === "string" && payload.to !== "slack-channel"
					? payload.to
					: process.env.SLACK_CHANNEL_ID;

			if (!botToken || !channelId) {
				logger.warn("Slack not configured — SLACK STUB", { to: payload.to });
				return {
					success: false,
					error: "Slack is not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID.",
				};
			}

			try {
				const { WebClient } = await import("@slack/web-api");
				// Bounded: an unbounded postMessage can hold the outbox
				// worker past the cron window.
				const client = new WebClient(botToken, { timeout: 15_000 });

				// Build Slack Block Kit message
				const blocks: (Block | KnownBlock)[] = [];

				if (payload.subject) {
					blocks.push({
						type: "header",
						text: { type: "plain_text", text: payload.subject, emoji: true },
					});
				}

				blocks.push({
					type: "section",
					text: { type: "mrkdwn", text: escapeSlackText(payload.body) },
				});

				if (payload.metadata) {
					// Fields that already appear in the message body — showing them
					// again as metadata just adds noise. Render-context internals
					// (taxonomy codes, duplicate dates, host/poc details the body
					// already names) are likewise never user-facing: dumping them
					// leaks internal variable names into staff channels.
					const redundantKeys = new Set([
						"leaveId",
						"approvalLink",
						"studentName",
						"rollNumber",
						"reason",
						"startDate",
						"endDate",
						"dates",
						"requestNumber",
						"leaveCategory",
						"leaveTypeName",
						"hostelName",
						"campus",
						"pocName",
						"expectedEntryTime",
					]);

					const lines = Object.entries(payload.metadata)
						.filter(([key, value]) => {
							if (redundantKeys.has(key)) return false;
							return typeof value === "string" && value.trim().length > 0;
						})
						.map(([key, value]) => `• *${key}:* ${escapeSlackText(value as string)}`);

					if (lines.length > 0) {
						blocks.push({ type: "divider" });
						blocks.push({
							type: "section",
							text: { type: "mrkdwn", text: lines.join("\n") },
						});
					}
				}

				if (payload.mentions && payload.mentions.length > 0) {
					blocks.push({
						type: "section",
						text: {
							type: "mrkdwn",
							text: `CC: ${payload.mentions.map(formatSlackMention).join(" ")}`,
						},
					});
				}

				const result = await client.chat.postMessage({
					channel: channelId,
					text: escapeSlackText(payload.subject ?? payload.body),
					blocks,
					mrkdwn: true,
					unfurl_links: false,
					unfurl_media: false,
				});

				return {
					success: true,
					messageId: `slack-${result.ts ?? Date.now()}`,
				};
			} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
				logger.error("Failed to send Slack message", { error: errorMessage });
				return {
					success: false,
					error: errorMessage,
				};
			}
		},
	};
}

