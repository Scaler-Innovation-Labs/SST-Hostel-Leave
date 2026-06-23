import type { Block, KnownBlock } from "@slack/web-api";

import { logger } from "@/lib/logger";

import type {
	NotificationPayload,
	NotificationSendResult,
} from "./notification-provider";

export function createSlackProvider() {
	return {
		async send(
			payload: NotificationPayload
		): Promise<NotificationSendResult> {
			const botToken = process.env.SLACK_BOT_TOKEN;
			const channelId = process.env.SLACK_CHANNEL_ID;

			if (!botToken || !channelId) {
				logger.warn("Slack not configured — SLACK STUB", { to: payload.to });
				return {
					success: false,
					error: "Slack is not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID.",
				};
			}

			try {
				const { WebClient } = await import("@slack/web-api");
				const client = new WebClient(botToken);

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
					text: { type: "mrkdwn", text: payload.body },
				});

				if (payload.metadata) {
					const fields = Object.entries(payload.metadata)
						.filter(([, v]) => typeof v === "string")
						.map(([key, value]) => ({
							type: "mrkdwn" as const,
							text: `*${key}:* ${value}`,
						}));

					if (fields.length > 0) {
						blocks.push({
							type: "section",
							fields,
						});
					}
				}

				const result = await client.chat.postMessage({
					channel: channelId,
					text: payload.subject ?? payload.body,
						blocks,
					mrkdwn: true,
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

