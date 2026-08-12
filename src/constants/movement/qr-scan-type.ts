export const QR_SCAN_TYPES = [
	"EXIT_SCAN",
	"RETURN_SCAN",
] as const;

export type QrScanType =
	(typeof QR_SCAN_TYPES)[number];

export const QR_SCAN_TYPE = {
	EXIT_SCAN: "EXIT_SCAN",
	RETURN_SCAN: "RETURN_SCAN",
} as const;