import { z } from "zod";

/**
 * Days as 0=Sunday … 6=Saturday (JS Date convention); at least one required.
 */
export const daysOfWeekSchema = z
	.array(z.number().int().min(0).max(6))
	.min(1, "Select at least one day")
	.max(7)
	.refine((days) => new Set(days).size === days.length, {
		message: "Duplicate days are not allowed",
	});

export const createLateStayAuthorizationSchema = z
	.object({
		leaveTypeId: z.string().uuid(),
		validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
		validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
		startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm"),
		endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm"),
		daysOfWeek: daysOfWeekSchema,
		reason: z.string().trim().min(10).max(500),
	})
	.refine((data) => data.validFrom <= data.validUntil, {
		message: "validUntil must not be before validFrom",
		path: ["validUntil"],
	})
	.refine((data) => data.startTime < data.endTime, {
		message: "endTime must be after startTime",
		path: ["endTime"],
	});

export type CreateLateStayAuthorizationDto = z.infer<
	typeof createLateStayAuthorizationSchema
>;

export const listLateStayAuthorizationsSchema = z.object({
	status: z
		.enum([
			"PENDING_POC",
			"PENDING_ADMIN",
			"ACTIVE",
			"REJECTED",
			"REVOKED",
			"EXPIRED",
			"SUPERSEDED",
		])
		.optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListLateStayAuthorizationsDto = z.infer<
	typeof listLateStayAuthorizationsSchema
>;

export const authorizeLateStaySchema = z.object({
	decision: z.enum(["APPROVED", "REJECTED"]),
	comments: z.string().trim().max(500).optional(),
});

export type AuthorizeLateStayDto = z.infer<typeof authorizeLateStaySchema>;

export const revokeLateStaySchema = z.object({
	reason: z.string().trim().min(3, "A reason is required").max(500),
});

export type RevokeLateStayDto = z.infer<typeof revokeLateStaySchema>;

/** Claim defaults to today (UTC date of the evaluation instant). */
export const claimLateStaySchema = z.object({
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
		.optional(),
});

export type ClaimLateStayDto = z.infer<typeof claimLateStaySchema>;
