import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { canRoleApprove } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { notificationService } from "@/services/notification/notification.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type AuthorizeLateStayResult = {
	authorizationId: string;
	status: string;
	nextStep: "POC" | "ADMIN" | null;
};

/**
 * Approve/reject a pending late-stay authorization.
 *
 * Fixed two-step chain: POC → ADMIN. Role hierarchy applies (an ADMIN may
 * act on the POC step; SUPER_ADMIN on any). POC approval moves
 * PENDING_POC → PENDING_ADMIN; ADMIN approval activates — and, for a child
 * version, atomically supersedes the still-ACTIVE parent in the same
 * transaction (V1 stays authoritative until V2 is approved).
 */
export async function authorizeLateStay(
	authorizationId: string,
	decision: "APPROVED" | "REJECTED",
	comments: string | undefined,
	currentUser: CurrentUser
): Promise<AuthorizeLateStayResult> {
	const authorization = await lateStayAuthorizationRepository.findByIdForUpdate(
		authorizationId
	);
	if (!authorization) {
		throw new NotFoundError("LateStayAuthorization");
	}

	if (
		authorization.status !== LATE_STAY_AUTH_STATUS.PENDING_POC &&
		authorization.status !== LATE_STAY_AUTH_STATUS.PENDING_ADMIN
	) {
		throw new ConflictError(
			"Authorization is not pending review (status: " + authorization.status + ")"
		);
	}

	const currentStep = authorization.status;

	// Step permission: the acting role must satisfy the current step.
	const requiredRole = currentStep === LATE_STAY_AUTH_STATUS.PENDING_POC ? "POC" : "ADMIN";
	const actingRoles = currentUser.roles as unknown as string[];
	if (!canRoleApprove(actingRoles as never, requiredRole)) {
		throw new AuthorizationError(
			`Only ${requiredRole} (or higher) can act on this authorization step`
		);
	}

	if (decision === LEAVE_APPROVAL_DECISION.REJECTED) {
		const rejected = await lateStayAuthorizationRepository.transitionStatus(
			authorizationId,
			[LATE_STAY_AUTH_STATUS.PENDING_POC, LATE_STAY_AUTH_STATUS.PENDING_ADMIN],
			LATE_STAY_AUTH_STATUS.REJECTED,
			{
				rejectedAt: new Date(),
				rejectedBy: currentUser.id,
			}
		);
		if (!rejected) throw new ConflictError("Authorization state changed concurrently");

		await auditService.record(
			AUDIT_ACTION.REJECT,
			AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
			authorizationId,
			currentUser.id,
			{ fromStatus: currentStep, toStatus: LATE_STAY_AUTH_STATUS.REJECTED, comments: comments ?? null }
		);

		await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_REJECTED, {
			leaveTypeId: authorization.leaveTypeId,
			studentId: authorization.studentId,
			variables: {
				validFrom: authorization.validFrom.toISOString().slice(0, 10),
				validUntil: authorization.validUntil.toISOString().slice(0, 10),
			},
		});

		return { authorizationId, status: LATE_STAY_AUTH_STATUS.REJECTED, nextStep: null };
	}

	// ----- APPROVE path -----
	if (currentStep === LATE_STAY_AUTH_STATUS.PENDING_POC) {
		const updated = await lateStayAuthorizationRepository.transitionStatus(
			authorizationId,
			[LATE_STAY_AUTH_STATUS.PENDING_POC],
			LATE_STAY_AUTH_STATUS.PENDING_ADMIN,
			{
				pocApprovedAt: new Date(),
				pocApprovedBy: currentUser.id,
			}
		);
		if (!updated) throw new ConflictError("Authorization state changed concurrently");

		await auditService.record(
			AUDIT_ACTION.APPROVE,
			AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
			authorizationId,
			currentUser.id,
			{ step: "POC", fromStatus: currentStep, toStatus: LATE_STAY_AUTH_STATUS.PENDING_ADMIN }
		);

		await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_STEP_APPROVED, {
			leaveTypeId: authorization.leaveTypeId,
			studentId: authorization.studentId,
			variables: { step: "POC" },
		});

		return {
			authorizationId,
			status: LATE_STAY_AUTH_STATUS.PENDING_ADMIN,
			nextStep: "ADMIN",
		};
	}

	// PENDING_ADMIN → ACTIVE. A child version must supersede its parent
	// atomically: one tx activates V(n) and retires V(n-1).
	if (authorization.parentAuthorizationId) {
		const activated = await transaction(async (tx) => {
			const child = await lateStayAuthorizationRepository.activateAndSupersede(
				authorizationId,
				authorization.parentAuthorizationId!,
				{
					pocApprovedAt:
						authorization.pocApprovedAt ?? new Date(),
					pocApprovedBy: authorization.pocApprovedBy ?? undefined,
					adminApprovedAt: new Date(),
					adminApprovedBy: currentUser.id,
				},
				tx
			);
			if (!child) {
				throw new ConflictError("Authorization state changed concurrently");
			}

			await auditService.record(
				AUDIT_ACTION.APPROVE,
				AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
				authorizationId,
				currentUser.id,
				{
					step: "ADMIN",
					fromStatus: currentStep,
					toStatus: LATE_STAY_AUTH_STATUS.ACTIVE,
					supersededParentId: authorization.parentAuthorizationId,
				},
				tx
			);

			return child;
		});

		await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_ACTIVE, {
			leaveTypeId: authorization.leaveTypeId,
			studentId: authorization.studentId,
			variables: {
				validFrom: authorization.validFrom.toISOString().slice(0, 10),
				validUntil: authorization.validUntil.toISOString().slice(0, 10),
			},
		});

		return {
			authorizationId,
			status: activated.status,
			nextStep: null,
		};
	}

	// V1 activation (no parent).
	const activated = await lateStayAuthorizationRepository.transitionStatus(
		authorizationId,
		[LATE_STAY_AUTH_STATUS.PENDING_ADMIN],
		LATE_STAY_AUTH_STATUS.ACTIVE,
		{
			adminApprovedAt: new Date(),
			adminApprovedBy: currentUser.id,
		}
	);
	if (!activated) throw new ConflictError("Authorization state changed concurrently");

	await auditService.record(
		AUDIT_ACTION.APPROVE,
		AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
		authorizationId,
		currentUser.id,
		{ step: "ADMIN", fromStatus: currentStep, toStatus: LATE_STAY_AUTH_STATUS.ACTIVE }
	);

	await outboxService.publish({
		eventType: OUTBOX_EVENT_TYPE.LATE_STAY_AUTH_ACTIVE,
		aggregateType: AGGREGATE_TYPE.LATE_STAY_AUTHORIZATION,
		aggregateId: authorizationId,
		payload: { authorizationId, studentId: authorization.studentId },
	});

	await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_ACTIVE, {
		leaveTypeId: authorization.leaveTypeId,
		studentId: authorization.studentId,
		variables: {
			validFrom: authorization.validFrom.toISOString().slice(0, 10),
			validUntil: authorization.validUntil.toISOString().slice(0, 10),
		},
	});

	return { authorizationId, status: LATE_STAY_AUTH_STATUS.ACTIVE, nextStep: null };
}
