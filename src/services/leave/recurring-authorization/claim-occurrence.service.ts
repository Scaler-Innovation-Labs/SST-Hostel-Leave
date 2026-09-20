import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ClaimLateStayDto } from "@/dto/leave/late-stay-authorization.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { evaluateCoverage } from "@/services/leave/recurring-authorization/evaluate-coverage.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ClaimOccurrenceResult = {
	occurrenceId: string;
	requestNumber: string;
	authorizationId: string;
	occurrenceDate: string;
	startAt: Date;
	endAt: Date;
	/** True when a previous claim (retry/double-click) already created it. */
	idempotentReplay: boolean;
};

/** Postgres unique-violation detection across drizzle's error wrapping. */
function isUniqueViolation(error: unknown): boolean {
	const code = (error as { code?: string } | null)?.code;
	if (code === "23505") return true;
	const causeCode = (error as { cause?: { code?: string } } | null)?.cause?.code;
	return causeCode === "23505";
}

/**
 * Layer 2 — the claim.
 *
 * "I'm staying late tonight" → ONE real leave_requests row, status
 * APPROVED, whose approval authority is inherited from the covering
 * authorization (provenance metadata + AUTO_APPROVED/SYSTEM approval row).
 * No human re-approves; no cron created it; movement treats it like any
 * approved leave.
 *
 * Concurrency: DB-level partial unique index
 * (metadata->>'authorizationId', metadata->>'occurrenceDate') WHERE live
 * arbitrates the race. A unique violation is caught and turned into the
 * idempotent "already claimed" response — check-then-insert alone cannot
 * be trusted.
 */
export async function claimLateStayOccurrence(
	authorizationId: string,
	dto: ClaimLateStayDto,
	currentUser: CurrentUser
): Promise<ClaimOccurrenceResult> {
	const student = await studentRepository.findByUserId(currentUser.id);
	if (!student) {
		throw new AuthorizationError("Only students can claim late-stay occurrences");
	}

	const authorization =
		await lateStayAuthorizationRepository.findById(authorizationId);
	if (!authorization) {
		throw new NotFoundError("LateStayAuthorization");
	}
	if (authorization.studentId !== student.id) {
		throw new AuthorizationError("Not your authorization");
	}

	const now = new Date();
	const occurrenceDate = dto.date ?? now.toISOString().slice(0, 10);

	// Only same-day claims are permitted (locked product decision).
	if (occurrenceDate !== now.toISOString().slice(0, 10)) {
		throw new ConflictError("Late-stay occurrences can only be claimed on the day");
	}

	if (authorization.status !== LATE_STAY_AUTH_STATUS.ACTIVE) {
		throw new ConflictError("Authorization is not ACTIVE");
	}

	const coverage = evaluateCoverage(authorization, now);
	if (!coverage.covered) {
		throw new ConflictError(
			`Authorization does not cover this time (${coverage.reason ?? "not covered"})`
		);
	}

	// Pessimistic lock to serialize claims against other writes while we
	// compute the occurrence window.
	const locked = await lateStayAuthorizationRepository.findByIdForUpdate(
		authorizationId
	);
	if (!locked || locked.status !== LATE_STAY_AUTH_STATUS.ACTIVE) {
		throw new ConflictError("Authorization is no longer active");
	}

	// Occurrence window = the authorization's daily window on the
	// occurrence's calendar day (UTC-of-instant convention).
	const startAt = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			Math.floor(authorization.startTimeMinutes / 60),
			authorization.startTimeMinutes % 60,
			0,
			0
		)
	);
	const endAt = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			Math.floor(authorization.endTimeMinutes / 60),
			authorization.endTimeMinutes % 60,
			0,
			0
		)
	);

	let created: {
		occurrence: {
			id: string;
			requestNumber: string;
			startAt: Date;
			endAt: Date;
		};
		idempotentReplay: boolean;
	};
	try {
		created = await transaction(async (tx) => {
		// Idempotency pre-check (the unique index is the true guarantee).
		const existing = await lateStayAuthorizationRepository.findOccurrence(
			authorizationId,
			occurrenceDate,
			tx
		);
		if (existing) {
			const full = await leaveRepository.findById(existing.id, tx);
			if (full) {
				return {
					occurrence: full,
					idempotentReplay: true,
				};
			}
		}

		// Cross-version guard: per-auth findOccurrence above cannot see a
		// sibling version's claim, so a V1 claim for tonight would not stop
		// a V2 claim for the same night. One night yields at most one live
		// occurrence per student + leave type — refuse the second version's
		// claim instead of materializing two leaves for one night.
		const crossVersion =
			await lateStayAuthorizationRepository.findLiveOccurrenceForStudentDate(
				student.id,
				authorization.leaveTypeId,
				occurrenceDate,
				tx
			);
		if (crossVersion) {
			if (crossVersion.authorizationId === authorizationId) {
				const full = await leaveRepository.findById(crossVersion.id, tx);
				if (full) {
					return {
						occurrence: full,
						idempotentReplay: true,
					};
				}
			}
			throw new ConflictError(
				"Tonight is already claimed under another authorization version"
			);
		}

		// Overlap guard: refuse claiming while the student is out of hostel
		// on an existing live leave (e.g. HOME_PASS until 21:30 tonight).
		const liveEnd = await lateStayAuthorizationRepository.findEarliestLiveLeaveEnd(
			student.id,
			now,
			tx
		);
		if (liveEnd && liveEnd.getTime() > startAt.getTime()) {
			throw new ConflictError(
				"An existing leave overlaps the claim window — return from that leave first"
			);
		}

		const requestNumber = `LR-${Date.now()}`;

		const occurrence = await leaveRepository.create(
			{
				requestNumber,
				studentId: student.id,
				leaveTypeId: authorization.leaveTypeId,
				reason: authorization.reason,
				status: LEAVE_REQUEST_STATUS.APPROVED,
				startAt,
				endAt,
				submittedForm: {
					occurrence: true,
					claimDate: occurrenceDate,
				},
				metadata: {
					authorizationId: authorization.id,
					authorizationVersion: authorization.version,
					occurrenceDate,
					approvalSource: "RECURRING_AUTHORIZATION",
				},
				submittedAt: now,
				approvedAt: now,
				// No currentStep: the approval chain is inherited, not re-run.
				currentStepKey: null,
				currentStepOrder: null,
			},
			tx
		);

		// Provenance row: an explicit AUTO_APPROVED / SYSTEM approval so
		// reports can distinguish machine-granted provenance from human
		// decisions. This is NOT a fabricated POC approval.
		await leaveApprovalRepository.createMany(
			[
				{
					leaveRequestId: occurrence.id,
					stepKey: "RECURRING_AUTHORIZATION",
					stepOrder: 0,
					approverRoleId: null,
					approverUserId: null,
					decision: LEAVE_APPROVAL_DECISION.AUTO_APPROVED,
					approvalSource: LEAVE_APPROVAL_SOURCE.SYSTEM,
					comments: `Auto-approved by recurring authorization ${authorization.id} (v${authorization.version})`,
					metadata: {
						authorizationId: authorization.id,
						authorizationVersion: authorization.version,
					},
					actedAt: now,
				},
			],
			tx
		);

		await auditService.record(
			AUDIT_ACTION.CREATE,
			AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
			occurrence.id,
			currentUser.id,
			{
				requestNumber,
				kind: "RECURRING_LATE_STAY_CLAIM",
				authorizationId: authorization.id,
				authorizationVersion: authorization.version,
				occurrenceDate,
			},
			tx
		);

		await outboxService.publish(
			{
				eventType: OUTBOX_EVENT_TYPE.LATE_STAY_CLAIMED,
				aggregateType: AGGREGATE_TYPE.LATE_STAY_AUTHORIZATION,
				aggregateId: authorization.id,
				payload: {
					occurrenceId: occurrence.id,
					authorizationId: authorization.id,
					occurrenceDate,
				},
			},
			tx
		);

		return {
			occurrence,
			idempotentReplay: false,
		};
	});
	} catch (error) {
		// Defense-in-depth: the FOR UPDATE lock above serializes same-
		// authorization claims, so a 23505 should be unreachable through this
		// service. The unique index remains the final arbiter if the lock is
		// ever bypassed (refactors, scripts, direct SQL) — translate it into
		// the idempotent replay instead of a raw 500.
		if (isUniqueViolation(error)) {
			const existing = await lateStayAuthorizationRepository.findOccurrence(
				authorizationId,
				occurrenceDate
			);
			if (existing) {
				const full = await leaveRepository.findById(existing.id);
				if (full) {
					return {
						occurrenceId: full.id,
						requestNumber: full.requestNumber,
						authorizationId,
						occurrenceDate,
						startAt: full.startAt,
						endAt: full.endAt,
						idempotentReplay: true,
					};
				}
			}
		}
		throw error;
	}

	return {
		occurrenceId: created.occurrence.id,
		requestNumber: created.occurrence.requestNumber,
		authorizationId,
		occurrenceDate,
		startAt: created.occurrence.startAt,
		endAt: created.occurrence.endAt,
		idempotentReplay: created.idempotentReplay,
	};
}
