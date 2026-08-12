export const LEAVE_REJECTION_SOURCES = [
	"POLICY",
	"VALIDATION",
] as const;

export type LeaveRejectionSource =
	(typeof LEAVE_REJECTION_SOURCES)[number];

export const LEAVE_REJECTION_SOURCE = {
	POLICY: "POLICY",
	VALIDATION: "VALIDATION",
} as const;
