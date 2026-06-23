export const MOVEMENT_METHODS = [
	"QR",
	"MANUAL",
	"SYSTEM",
] as const;

export type MovementMethod =
	(typeof MOVEMENT_METHODS)[number];

export const MOVEMENT_METHOD = {
	QR: "QR",
	MANUAL: "MANUAL",
	SYSTEM: "SYSTEM",
} as const;
