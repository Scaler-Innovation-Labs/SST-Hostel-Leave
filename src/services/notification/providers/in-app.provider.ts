import { logger } from "@/lib/logger";

import type {
	NotificationPayload,
	NotificationSendResult,
} from "./notification-provider";

export function createInAppProvider() {
	return {
		async send(
			payload: NotificationPayload
		): Promise<NotificationSendResult> {
			// In-app notifications are stored as notificationLog rows with PENDING status.
			// The frontend polls or uses WebSocket for real-time updates.
		logger.debug("In-app notification sent", { to: payload.to });

			return {
				success: true,
				messageId: `inapp-${Date.now()}`,
			};
		},
	};
}
