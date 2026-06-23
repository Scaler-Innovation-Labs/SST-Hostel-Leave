export const LEAVE_WORKFLOW_MODES = ["HOSTEL", "ACADEMIC"] as const;

export type LeaveWorkflowMode =
	(typeof LEAVE_WORKFLOW_MODES)[number];

export const LEAVE_WORKFLOW_MODE = {
	HOSTEL: "HOSTEL",
	ACADEMIC: "ACADEMIC",
} as const;
