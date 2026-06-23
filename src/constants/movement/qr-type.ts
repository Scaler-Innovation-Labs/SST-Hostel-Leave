export const QR_TYPES = [
	"LEAVE_EXIT",
	"LEAVE_RETURN",
] as const;

export type QrType =
	(typeof QR_TYPES)[number];

export const QR_TYPE = {
	LEAVE_EXIT: "LEAVE_EXIT",
	LEAVE_RETURN: "LEAVE_RETURN",
} as const;
