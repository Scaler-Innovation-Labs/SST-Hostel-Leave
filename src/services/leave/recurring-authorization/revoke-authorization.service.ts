import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { notificationService } from "@/services/notification/notification.service";
import { outboxService } from "@/services/outbox/outbox.service";

/**
 * Revocation (ACTIVE → REVOKED) — POC/ADMIN only, with a mandatory reason.
 *
 * Domain rule (locked in design): revocation blocks FUTURE claims but does
 * NOT retroactively mutate already-claimed occurrences. A claimed
 * occurrence is a durable, auto-approved leave that finishes its own
 * lifecycle (QR → scan → completion) — re-evaluating the authorization
 * would rewrite historical truth.
 */
export async function revokeLateStayAuthorization(
	authorizationId: string,
	reason: string,
	currentUser: CurrentUser
) {
	if (!reason || reason.trim().length < 3) {
		throw new ValidationError("A revocation reason is required");
	}

	const authorization = await lateStayAuthorizationRepository.findById(
		authorizationId
	);
	if (!authorization) {
		throw new NotFoundError("LateStayAuthorization");
	}

	// Role check: POC or above may revoke.
	const actingRoles = currentUser.roles as unknown as string[];
	const canRevoke = actingRoles.some((role) =>
		["POC", "ADMIN", "SUPER_ADMIN"].includes(role)
	);
	if (!canRevoke) {
		throw new AuthorizationError("Only POC or admins can revoke an authorization");
	}

	if (authorization.status !== LATE_STAY_AUTH_STATUS.ACTIVE) {
		throw new ConflictError(
			`Only ACTIVE authorizations can be revoked (current: ${authorization.status})`
		);
	}

	const revoked = await transaction(async (tx) => {
		const updated = await lateStayAuthorizationRepository.transitionStatus(
			authorizationId,
			[LATE_STAY_AUTH_STATUS.ACTIVE],
			LATE_STAY_AUTH_STATUS.REVOKED,
			{
				revokeReason: reason.trim(),
				revokedAt: new Date(),
				revokedBy: currentUser.id,
			},
			tx
		);
		if (!updated) {
			throw new ConflictError("Authorization state changed concurrently");
		}

		await auditService.record(
			AUDIT_ACTION.REVOKE,
			AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
			authorizationId,
			currentUser.id,
			{
				fromStatus: LATE_STAY_AUTH_STATUS.ACTIVE,
				toStatus: LATE_STAY_AUTH_STATUS.REVOKED,
				reason: reason.trim(),
			},
			tx
		);

		await outboxService.publish(
			{
				eventType: OUTBOX_EVENT_TYPE.LATE_STAY_AUTH_REVOKED,
				aggregateType: AGGREGATE_TYPE.LATE_STAY_AUTHORIZATION,
				aggregateId: authorizationId,
				payload: { authorizationId, studentId: authorization.studentId },
			},
			tx
		);

		return updated;
	});

	await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_REVOKED, {
		leaveTypeId: authorization.leaveTypeId,
		studentId: authorization.studentId,
		variables: {
			reason: reason.trim(),
			validUntil: authorization.validUntil.toISOString().slice(0, 10),
		},
	});

	return revoked;
}
