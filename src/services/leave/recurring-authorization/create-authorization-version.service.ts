import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LATE_STAY_AUTH_STATUS } from "@/constants/leave/late-stay-authorization";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
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
 * Versioned change flow: a change to an ACTIVE authorization (later end
 * time, extra days, extended validity) creates a PENDING child version —
 * it NEVER mutates the active row. Until the child is approved, the parent
 * remains ACTIVE and claims keep resolving against it. Approval of the
 * child atomically supersedes the parent (activateAndSupersede).
 */
export async function createLateStayAuthorizationVersion(
	parentAuthorizationId: string,
	dto: CreateLateStayAuthorizationDto,
	currentUser: CurrentUser
) {
	const student = await studentRepository.findByUserId(currentUser.id);
	if (!student) {
		throw new AuthorizationError("Only students can request late-stay authorization versions");
	}

	const parent = await lateStayAuthorizationRepository.findById(
		parentAuthorizationId
	);
	if (!parent) {
		throw new NotFoundError("LateStayAuthorization");
	}
	if (parent.studentId !== student.id) {
		throw new AuthorizationError("Not your authorization");
	}
	if (parent.status !== LATE_STAY_AUTH_STATUS.ACTIVE) {
		throw new ConflictError(
			"Only an ACTIVE authorization can be superseded by a new version"
		);
	}

	// One pending child at a time per lineage: any live (pending) child
	// blocks creating another, so the lineage has at most one successor.
	const studentUser = await userRepository.findById(currentUser.id);

	const overlapping = await lateStayAuthorizationRepository.findLiveOverlapping({
		studentId: student.id,
		leaveTypeId: parent.leaveTypeId,
		validFrom: parseDtoValidFrom(dto),
		validUntil: parseDtoValidUntil(dto),
		excludeAuthorizationId: parent.id,
	});

	const pendingSibling = overlapping.find(
		(row) => row.parentAuthorizationId === parent.id
	);
	if (pendingSibling) {
		throw new ConflictError(
			"A version change for this authorization is already pending review"
		);
	}

	const anyLiveOther = overlapping.length > 0;
	if (anyLiveOther) {
		throw new ConflictError(
			"The requested window overlaps another pending or active authorization"
		);
	}

	const validFrom = parseDtoValidFrom(dto);
	const validUntil = parseDtoValidUntil(dto);
	const startTimeMinutes = parseHHMM(dto.startTime);
	const endTimeMinutes = parseHHMM(dto.endTime);

	let mask = 0;
	for (const day of dto.daysOfWeek) mask |= 1 << day;

	const child = await transaction(async (tx) => {
		const created = await lateStayAuthorizationRepository.create(
			{
				studentId: student.id,
				leaveTypeId: parent.leaveTypeId,
				parentAuthorizationId: parent.id,
				version: parent.version + 1,
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
			created.id,
			currentUser.id,
			{
				parentAuthorizationId: parent.id,
				version: created.version,
				studentId: student.id,
			},
			tx
		);

		await outboxService.publish(
			{
				eventType: OUTBOX_EVENT_TYPE.LATE_STAY_AUTH_CREATED,
				aggregateType: AGGREGATE_TYPE.LATE_STAY_AUTHORIZATION,
				aggregateId: created.id,
				payload: { authorizationId: created.id, studentId: student.id, version: created.version },
			},
			tx
		);

		return created;
	});

	await notificationService.notify(NOTIFICATION_EVENT.LATE_STAY_AUTH_SUBMITTED, {
		leaveTypeId: parent.leaveTypeId,
		studentId: student.id,			variables: {
				studentName: studentUser?.fullName ?? "Student",
			validFrom: dto.validFrom,
			validUntil: dto.validUntil,
			reason: dto.reason,
			version: String(child.version),
		},
	});

	return child;
}

function parseDtoValidFrom(dto: CreateLateStayAuthorizationDto): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dto.validFrom);
	if (!match) throw new ValidationError("Invalid validFrom (expected YYYY-MM-DD)");
	return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function parseDtoValidUntil(dto: CreateLateStayAuthorizationDto): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dto.validUntil);
	if (!match) throw new ValidationError("Invalid validUntil (expected YYYY-MM-DD)");
	return new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) +
			24 * 60 * 60 * 1000 -
			1
	);
}

function parseHHMM(value: string): number {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
	if (!match) throw new ValidationError(`Invalid time "${value}" (expected HH:mm)`);
	return Number(match[1]) * 60 + Number(match[2]);
}
