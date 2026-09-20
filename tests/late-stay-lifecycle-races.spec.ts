// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockFindActiveByStudent = vi.fn();
const mockFindActiveForStudentForUpdate = vi.fn();
const mockFindOccurrence = vi.fn();
const mockFindLiveOccurrenceForStudentDate = vi.fn();
const mockFindEarliestLiveLeaveEnd = vi.fn();
const mockTransitionStatus = vi.fn();
const mockExpireDue = vi.fn();
const mockFindStudentByUserId = vi.fn();
const mockFindLeaveTypeByCode = vi.fn();
const mockLeaveCreate = vi.fn();
const mockLeaveFindById = vi.fn().mockResolvedValue(null);
const mockApprovalCreateMany = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/db", () => {
	const tx: Record<string, any> = {};
	tx.insert = vi.fn(() => tx);
	tx.select = vi.fn(() => tx);
	tx.update = vi.fn(() => tx);
	tx.delete = vi.fn(() => tx);
	tx.from = vi.fn(() => tx);
	tx.where = vi.fn(() => tx);
	tx.values = vi.fn(() => tx);
	tx.set = vi.fn(() => tx);
	tx.returning = vi.fn().mockResolvedValue([]);
	tx.limit = vi.fn(() => tx);
	tx.orderBy = vi.fn(() => tx);
	tx.offset = vi.fn(() => tx);
	tx.innerJoin = vi.fn(() => tx);
	tx.leftJoin = vi.fn(() => tx);
	tx.$dynamic = vi.fn(() => tx);
	tx.for = vi.fn(() => tx);
	return {
		db: {
			transaction: (cb: any) => cb(tx),
			...tx,
		},
	};
});

vi.mock("@/db/repositories/leave/late-stay-authorization.repository", () => ({
	lateStayAuthorizationRepository: {
		findById: (...args: any[]) => mockFindById(...args),
		findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
		findActiveByStudent: (...args: any[]) => mockFindActiveByStudent(...args),
		findActiveForStudentForUpdate: (...args: any[]) =>
			mockFindActiveForStudentForUpdate(...args),
		findOccurrence: (...args: any[]) => mockFindOccurrence(...args),
		findLiveOccurrenceForStudentDate: (...args: any[]) =>
			mockFindLiveOccurrenceForStudentDate(...args),
		findEarliestLiveLeaveEnd: (...args: any[]) =>
			mockFindEarliestLiveLeaveEnd(...args),
		transitionStatus: (...args: any[]) => mockTransitionStatus(...args),
		expireDue: (...args: any[]) => mockExpireDue(...args),
	},
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
	leaveRepository: {
		create: (...args: any[]) => mockLeaveCreate(...args),
		findById: (...args: any[]) => mockLeaveFindById(...args),
	},
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
	leaveApprovalRepository: {
		createMany: (...args: any[]) => mockApprovalCreateMany(...args),
	},
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
	studentRepository: {
		findByUserId: (...args: any[]) => mockFindStudentByUserId(...args),
	},
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
	leaveTypeRepository: {
		findByCode: (...args: any[]) => mockFindLeaveTypeByCode(...args),
	},
}));

vi.mock("@/services/audit/audit.service", () => ({
	auditService: {
		record: (...args: any[]) => mockAuditRecord(...args),
	},
}));

vi.mock("@/services/outbox/outbox.service", () => ({
	outboxService: {
		publish: (...args: any[]) => mockOutboxPublish(...args),
	},
}));

vi.mock("@/services/notification/notification.service", () => ({
	notificationService: {
		notify: (...args: any[]) => mockNotify(...args),
	},
}));

const { claimLateStayOccurrence } = await import(
	"@/services/leave/recurring-authorization/claim-occurrence.service"
);
const { getLateStayClaimEligibility } = await import(
	"@/services/leave/recurring-authorization/claim-eligibility.service"
);
const { assertNoActiveAuthorizationCoverage } = await import(
	"@/services/leave/recurring-authorization/duplicate-application-guard.service"
);
const { revokeLateStayAuthorization } = await import(
	"@/services/leave/recurring-authorization/revoke-authorization.service"
);
const { expireAuthorizations } = await import(
	"@/services/leave/recurring-authorization/expire-authorizations.service"
);
const { evaluateCoverage } = await import(
	"@/services/leave/recurring-authorization/evaluate-coverage.service"
);
const { LATE_STAY_AUTH_STATUS } = await import(
	"@/constants/leave/late-stay-authorization"
);
const { AUDIT_ACTION } = await import("@/constants/audit/audit-action");

const STUDENT = { id: "S1", userId: "U1", name: "Varshit" };
const STUDENT_USER = { id: "U1", roles: [{ name: "STUDENT" }] };
const POC_USER = { id: "STAFF1", roles: ["POC"] };

/** V1: ACTIVE, Mon–Fri 18:00–22:00, Sep 15 → Oct 15 2026. */
const V1 = {
	id: "V1",
	studentId: "S1",
	leaveTypeId: "LT1",
	parentAuthorizationId: null,
	version: 1,
	status: LATE_STAY_AUTH_STATUS.ACTIVE,
	validFrom: new Date("2026-09-15T00:00:00Z"),
	validUntil: new Date("2026-10-15T23:59:59.999Z"),
	startTimeMinutes: 18 * 60,
	endTimeMinutes: 22 * 60,
	daysOfWeekMask: 0b0111110,
	reason: "Lab work",
};

/** V2: superseding child, same student + type, ACTIVE after approval. */
const V2 = {
	...V1,
	id: "V2",
	parentAuthorizationId: "V1",
	version: 2,
};

beforeEach(() => {
	vi.clearAllMocks();
	mockFindStudentByUserId.mockResolvedValue(STUDENT);
	mockFindLeaveTypeByCode.mockResolvedValue({ id: "LT1", code: "LATE_STAY_COLLEGE" });
	mockFindOccurrence.mockResolvedValue(null);
	mockFindLiveOccurrenceForStudentDate.mockResolvedValue(null);
	mockFindEarliestLiveLeaveEnd.mockResolvedValue(null);
	mockLeaveFindById.mockResolvedValue(null);
	mockApprovalCreateMany.mockResolvedValue([]);
	mockFindActiveByStudent.mockResolvedValue([]);
	mockFindActiveForStudentForUpdate.mockResolvedValue([]);
});

describe("V1 claim blocks a V2 claim for the same night", () => {
	it("refuses a V2 claim when V1 already claimed tonight", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindById.mockResolvedValue(V2);
		mockFindByIdForUpdate.mockResolvedValue(V2);
		mockFindOccurrence.mockResolvedValue(null);
		mockFindLiveOccurrenceForStudentDate.mockResolvedValue({
			id: "LR-V1",
			authorizationId: "V1",
		});

		await expect(
			claimLateStayOccurrence("V2", {}, STUDENT_USER)
		).rejects.toThrow(/another authorization version/);
		expect(mockLeaveCreate).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("reports ALREADY_CLAIMED on V2 eligibility when V1 claimed tonight", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindActiveForStudentForUpdate.mockResolvedValue([V2]);
		mockFindOccurrence.mockResolvedValue(null);
		mockFindLiveOccurrenceForStudentDate.mockResolvedValue({
			id: "LR-V1",
			authorizationId: "V1",
		});

		const eligibility = await getLateStayClaimEligibility(STUDENT_USER);

		expect(eligibility.eligible).toBe(false);
		expect(eligibility.reason).toBe("ALREADY_CLAIMED");
		expect(eligibility.alreadyClaimed?.id).toBe("LR-V1");
		vi.useRealTimers();
	});
});

describe("claim × revoke ordering", () => {
	it("claim loses when revocation commits first", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindById.mockResolvedValue(V1);
		mockFindByIdForUpdate.mockResolvedValue({
			...V1,
			status: LATE_STAY_AUTH_STATUS.REVOKED,
		});

		await expect(
			claimLateStayOccurrence("V1", {}, STUDENT_USER)
		).rejects.toThrow(/no longer active/);
		expect(mockLeaveCreate).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("revoke loses when the claim commits first", async () => {
		mockFindById.mockResolvedValue(V1);
		// WHERE status = ACTIVE no longer matches — the claim won the race.
		mockTransitionStatus.mockResolvedValue(null);

		await expect(
			revokeLateStayAuthorization("V1", "no longer needed", POC_USER)
		).rejects.toThrow(/changed concurrently/);
	});
});

describe("expiry boundary", () => {
	it("covers the validUntil evening but not the day after", () => {
		// Oct 15 is a Thursday — a valid weekday inside validity.
		const lastEvening = new Date(Date.UTC(2026, 9, 15, 20, 0));
		expect(evaluateCoverage(V1, lastEvening).covered).toBe(true);

		// Oct 16 is past validity even though it is a weekday.
		const dayAfter = new Date(Date.UTC(2026, 9, 16, 20, 0));
		const result = evaluateCoverage(V1, dayAfter);
		expect(result.covered).toBe(false);
		expect(result.reason).toBe("AFTER_VALIDITY");
	});

	it("claim is refused once expiry flips the row", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindById.mockResolvedValue(V1);
		mockFindByIdForUpdate.mockResolvedValue({
			...V1,
			status: LATE_STAY_AUTH_STATUS.EXPIRED,
		});

		await expect(
			claimLateStayOccurrence("V1", {}, STUDENT_USER)
		).rejects.toThrow(/no longer active/);
		expect(mockLeaveCreate).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("expiry pass retires due authorizations with audit", async () => {
		mockExpireDue.mockResolvedValue([
			{ id: "A1", validUntil: new Date("2026-09-15T23:59:59.999Z") },
		]);

		const result = await expireAuthorizations();

		expect(result.count).toBe(1);
		expect(mockAuditRecord).toHaveBeenCalledTimes(1);
		expect(mockAuditRecord.mock.calls[0][0]).toBe(AUDIT_ACTION.EXPIRE);
		expect(mockAuditRecord.mock.calls[0][2]).toBe("A1");
	});
});

describe("manual application × versioning", () => {
	it("allows a manual application once the lineage is fully superseded", async () => {
		// V1 SUPERSEDED and V2 not yet active: no ACTIVE row remains.
		mockFindActiveByStudent.mockResolvedValue([]);

		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-23T18:30:00Z"),
				endAt: new Date("2026-09-23T21:30:00Z"),
			})
		).resolves.toBeUndefined();
	});

	it("rejects a manual application fully covered by the superseding V2", async () => {
		mockFindActiveByStudent.mockResolvedValue([V2]);

		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-23T18:30:00Z"),
				endAt: new Date("2026-09-23T21:30:00Z"),
			})
		).rejects.toThrow(/active recurring late-stay authorization/);
	});

	it("allows a manual window only partially covered by V2", async () => {
		mockFindActiveByStudent.mockResolvedValue([V2]);

		// Starts before the 18:00 daily window — not fully covered.
		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-23T17:30:00Z"),
				endAt: new Date("2026-09-23T21:30:00Z"),
			})
		).resolves.toBeUndefined();
	});
});
