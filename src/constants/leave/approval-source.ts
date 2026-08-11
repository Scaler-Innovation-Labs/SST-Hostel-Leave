export const LEAVE_APPROVAL_SOURCES = [
	"WEB",
	"SMS",
	"MANUAL",
	"SYSTEM",
	"PORTAL",
	"EMAIL_LINK",
] as const;

export type LeaveApprovalSource =
	(typeof LEAVE_APPROVAL_SOURCES)[number];

export const LEAVE_APPROVAL_SOURCE = {
	WEB: "WEB",
	SMS: "SMS",
	MANUAL: "MANUAL",
	SYSTEM: "SYSTEM",
	PORTAL: "PORTAL",
	EMAIL_LINK: "EMAIL_LINK",
} as const;
