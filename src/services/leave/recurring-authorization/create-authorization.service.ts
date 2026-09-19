import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import {
	parseDateOnlyToUtcEnd,
	parseDateOnlyToUtcStart,
	parseHHMMToMinutes,
} from "@/constants/leave/late-stay-authorization";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { CreateLateStayAuthorizationDto } from "@/dto/leave/late-stay-authorization.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { notificationService } from "@/services/notification/notification.service";
import { outboxService } from "@/services/outbox/outbox.service";

/**
 * Layer 1 entry point: a student requests a RECURRING late-stay
 * authorization (validity window × weekday mask × daily time window).
 *
 * Domain validation (server-side, not UI):
 *   - leave type must exist and be active
 *   - no overlapping live (pending/active) authorization of the same
 *     student + leave type — same principle as assertNoConflictingOverlap
 *
 * A child version (parentAuthorizationId set) is created by
 * create-authorization-version.service, not here.
 */
export async function createLateStayAuthorization(
	dto: CreateLateStayAuthorizationDto,
	currentUser: CurrentUser
) {
	const student = await studentRepository.findByUserId(currentUser.id);
	if (!student) {
		throw new AuthorizationError("Only students can request late-stay authorizations");
	}

	const leaveType = await leaveTypeRepository.findById(dto.leaveTypeId);
	if (!leaveType) {
		throw new NotFoundError("LeaveType");
	}
	if (!leaveType.isActive) {
		throw new ValidationError("Leave type is not active");
	}

	const validFrom = parseDateOnlyToUtcStart(dto.validFrom);
	const validUntil = parseDateOnlyToUtcEnd(dto.validUntil);
	const startTimeMinutes = parseHHMMToMinutes(dto.startTime);
	const endTimeMinutes = parseHHMMToMinutes(dto.endTime);

	let mask = 0;
	for (const day of dto.daysOfWeek) mask |= 1 << day;

	// Max window bound keeps countEligibleNights and reporting bounded.
	const MAX_WINDOW_DAYS = 365;
	if (
		(validUntil.getTime() - validFrom.getTime()) /
			(24 * 60 * 60 * 1000) >
		MAX_WINDOW_DAYS
	) {
		throw new ValidationError("Authorization window cannot exceed 365 days");
	}

	const studentUser = await userRepository.findById(currentUser.id);

	const overlapping = await lateStayAuthorizationRepository.findLiveOverlapping({
		studentId: student.id,
		leaveTypeId: leaveType.id,
		validFrom,
		validUntil,
	});

	if (overlapping.length > 0) {
		throw new ConflictError(
			"You already have a pending or active late-stay authorization overlapping this period"
		);
	}

	const created = await transaction(async (tx) => {
		const authorization = await lateStayAuthorizationRepository.create(
			{
				studentId: student.id,
				leaveTypeId: leaveType.id,
				parentAuthorizationId: null,
				version: 1,
				validFrom,
				validUntil,
				startTimeMinutes,
				endTimeMinutes,
				daysOfWeekMask: mask,
				reason: dto.reason,
				status: LATE_STAY_AUTH_STATUS.PENDING_POC,
			},
			tx
		);

		await auditService.record(
			AUDIT_ACTION.CREATE,
			AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
			authorization.id,
			currentUser.id,
			{
				studentId: student.id,
				leaveTypeId: leaveType.id,
				validFrom: dto.validFrom,
				validUntil: dto.validUntil,
				daysOfWeek: dto.daysOfWeek,
				startTime: dto.startTime,
				endTime: dto.endTime,
			},
			tx
		);

		await outboxService.publish(
			{
				eventType: OUTBOX_EVENT_TYPE.LATE_STAY_AUTH_CREATED,
				aggregateType: AGGREGATE_TYPE.LATE_STAY_AUTHORIZATION,
				aggregateId: authorization.id,
				payload: {
					authorizationId: authorization.id,
					studentId: student.id,
				},
			},
			tx
		);

		return authorization;
	});

	// Post-commit, best-effort: alert the POC that an authorization awaits
	// their review (mirrors leave_submitted POC Slack rules).
	await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_SUBMITTED, {
		leaveTypeId: leaveType.id,
		studentId: student.id,
		variables: {
			studentName: studentUser?.fullName ?? "Student",
			validFrom: dto.validFrom,
			validUntil: dto.validUntil,
			reason: dto.reason,
		},
	});

	return created;
}
