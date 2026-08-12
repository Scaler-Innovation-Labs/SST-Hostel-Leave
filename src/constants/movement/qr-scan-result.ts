export const QR_SCAN_RESULTS = [
	"SUCCESS",
	"FAILED",
] as const;

export type QrScanResult =
	(typeof QR_SCAN_RESULTS)[number];

export const QR_SCAN_RESULT = {
	SUCCESS: "SUCCESS",
	FAILED: "FAILED",
} as const;