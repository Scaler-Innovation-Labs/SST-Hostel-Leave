import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { evaluateCoverage } from "@/services/leave/recurring-authorization/evaluate-coverage.service";

export type ClaimEligibility = {
	/** Whether an ACTIVE authorization covers the instant. */
	eligible: boolean;
	/** The covering authorization, when eligible. */
	authorization: {
		id: string;
		version: number;
		validFrom: Date;
		validUntil: Date;
		startTimeMinutes: number;
		endTimeMinutes: number;
		daysOfWeekMask: number;
	} | null;
	/** Occurrence already claimed for the target date, when one exists. */
	alreadyClaimed: { id: string } | null;
	/** Diagnostics when not eligible (from evaluateCoverage). */
	reason?:
		| "NO_ACTIVE_AUTHORIZATION"
		| "NOT_COVERED"
		| "ALREADY_CLAIMED";
	coverageReason?: string;
	targetDate: string;
};

/**
 * "Can this student claim a late-stay occurrence right now?" — a pure
 * evaluation over active authorizations; no cron, no materialization.
 */
export async function getLateStayClaimEligibility(
	currentUser: CurrentUser,
	targetDate?: string
): Promise<ClaimEligibility> {
	const student = await studentRepository.findByUserId(currentUser.id);
	const now = new Date();
	const date =
		targetDate ??
		now.toISOString().slice(0, 10);

	if (!student) {
		return {
			eligible: false,
			authorization: null,
			alreadyClaimed: null,
			reason: "NO_ACTIVE_AUTHORIZATION",
			targetDate: date,
		};
	}

	// Late-stay is anchored to the LATE_STAY_COLLEGE leave type.
	const leaveTypeId = await resolveLateStayLeaveTypeId();
	if (!leaveTypeId) {
		return {
			eligible: false,
			authorization: null,
			alreadyClaimed: null,
			reason: "NO_ACTIVE_AUTHORIZATION",
			targetDate: date,
		};
	}

	const activeAuthorizations =
		await lateStayAuthorizationRepository.findActiveForStudentForUpdate(
			student.id,
			leaveTypeId
		);

	const covering = activeAuthorizations.find((authorization) =>
		evaluateCoverage(authorization, now).covered
	);

	if (!covering) {
		return {
			eligible: false,
			authorization: null,
			alreadyClaimed: null,
			reason: "NOT_COVERED",
			targetDate: date,
		};
	}

	const occurrenceDate = targetDate ?? now.toISOString().slice(0, 10);
	const existing = await lateStayAuthorizationRepository.findOccurrence(
		covering.id,
		occurrenceDate
	);

	return {
		eligible: !existing,
		authorization: {
			id: covering.id,
			version: covering.version,
			validFrom: covering.validFrom,
			validUntil: covering.validUntil,
			startTimeMinutes: covering.startTimeMinutes,
			endTimeMinutes: covering.endTimeMinutes,
			daysOfWeekMask: covering.daysOfWeekMask,
		},
		alreadyClaimed: existing ?? null,
		reason: existing ? "ALREADY_CLAIMED" : undefined,
		targetDate: occurrenceDate,
	};
}

async function resolveLateStayLeaveTypeId(): Promise<string | null> {
	const leaveType = await leaveTypeRepository.findByCode("LATE_STAY_COLLEGE");
	return leaveType?.id ?? null;
}
