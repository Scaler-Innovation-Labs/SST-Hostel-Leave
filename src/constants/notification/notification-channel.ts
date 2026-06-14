export const NOTIFICATION_CHANNELS = [
	"EMAIL",
	"SMS",
	"PUSH",
	"WEBHOOK",
	"SLACK",
] as const;

export type NotificationChannel =
	(typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL = {
	EMAIL: "EMAIL",
	SMS: "SMS",
	PUSH: "PUSH",
	WEBHOOK: "WEBHOOK",
	SLACK: "SLACK",
} as const;
