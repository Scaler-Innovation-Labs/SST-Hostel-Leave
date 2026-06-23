export const NOTIFICATION_DELIVERY_STATUSES = [
	"PENDING",
	"SENT",
	"FAILED",
	"DELIVERED",
	"READ",
] as const;

export type NotificationDeliveryStatus =
	(typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_DELIVERY_STATUS = {
	PENDING: "PENDING",
	SENT: "SENT",
	FAILED: "FAILED",
	DELIVERED: "DELIVERED",
	READ: "READ",
} as const;
