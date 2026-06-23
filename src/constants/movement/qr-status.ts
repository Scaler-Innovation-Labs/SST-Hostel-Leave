export const QR_STATUSES = [
	"ACTIVE",
	"USED",
	"EXPIRED",
	"INVALIDATED",
] as const;

export type QrStatus =
	(typeof QR_STATUSES)[number];

export const QR_STATUS = {
	ACTIVE: "ACTIVE",
	USED: "USED",
	EXPIRED: "EXPIRED",
	INVALIDATED: "INVALIDATED",
} as const;
