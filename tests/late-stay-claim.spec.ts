// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockFindActiveByStudent = vi.fn();
const mockFindActiveForStudentForUpdate = vi.fn();
const mockFindOccurrence = vi.fn();
const mockFindEarliestLiveLeaveEnd = vi.fn();
const mockFindStudentByUserId = vi.fn();
const mockFindLeaveTypeByCode = vi.fn();
const mockLeaveCreate = vi.fn();
const mockApprovalCreateMany = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();

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
		findEarliestLiveLeaveEnd: (...args: any[]) =>
			mockFindEarliestLiveLeaveEnd(...args),
	},
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
	leaveRepository: {
		create: (...args: any[]) => mockLeaveCreate(...args),
		findById: vi.fn().mockResolvedValue(null),
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

const { claimLateStayOccurrence } = await import(
	"@/services/leave/recurring-authorization/claim-occurrence.service"
);
const { getLateStayClaimEligibility } = await import(
	"@/services/leave/recurring-authorization/claim-eligibility.service"
);
const { assertNoActiveAuthorizationCoverage } = await import(
	"@/services/leave/recurring-authorization/duplicate-application-guard.service"
);
const { LATE_STAY_AUTH_STATUS } = await import(
	"@/constants/leave/late-stay-authorization"
);

const STUDENT = { id: "S1", userId: "U1", name: "Varshit" };
const USER = { id: "U1", roles: [{ name: "STUDENT" }] };

/** Authorization covering Mon–Fri 18:00–22:00, Sep 15 → Oct 15 2026. */
const ACTIVE_AUTH = {
	id: "AUTH1",
	studentId: "S1",
	leaveTypeId: "LT1",
	version: 1,
	status: LATE_STAY_AUTH_STATUS.ACTIVE,
	validFrom: new Date("2026-09-15T00:00:00Z"),
	validUntil: new Date("2026-10-15T23:59:59.999Z"),
	startTimeMinutes: 18 * 60,
	endTimeMinutes: 22 * 60,
	daysOfWeekMask: 0b0111110,
	reason: "Lab work",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockFindStudentByUserId.mockResolvedValue(STUDENT);
	mockFindById.mockResolvedValue(ACTIVE_AUTH);
	mockFindByIdForUpdate.mockResolvedValue(ACTIVE_AUTH);
	mockFindOccurrence.mockResolvedValue(null);
	mockFindEarliestLiveLeaveEnd.mockResolvedValue(null);
	mockFindLeaveTypeByCode.mockResolvedValue({ id: "LT1", code: "LATE_STAY_COLLEGE" });
	mockLeaveCreate.mockImplementation(async (values: any) => ({
		id: "LR1",
		requestNumber: values.requestNumber,
		startAt: values.startAt,
		endAt: values.endAt,
	}));
	mockApprovalCreateMany.mockResolvedValue([]);
	mockFindActiveByStudent.mockResolvedValue([]);
});

describe("claimLateStayOccurrence", () => {
	it("materializes an APPROVED occurrence with recurring provenance", async () => {
		// Freeze "now" inside a covered Tuesday evening.
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });

		const result = await claimLateStayOccurrence("AUTH1", {}, USER);

		expect(mockLeaveCreate).toHaveBeenCalledTimes(1);
		const created = mockLeaveCreate.mock.calls[0][0];
		expect(created.status).toBe("APPROVED");
		expect(created.metadata.authorizationId).toBe("AUTH1");
		expect(created.metadata.approvalSource).toBe("RECURRING_AUTHORIZATION");
		expect(created.startAt.getUTCHours()).toBe(18);
		expect(created.endAt.getUTCHours()).toBe(22);

		// Provenance approval row: AUTO_APPROVED / SYSTEM — not a fake POC.
		expect(mockApprovalCreateMany).toHaveBeenCalledTimes(1);
		const approval = mockApprovalCreateMany.mock.calls[0][0][0];
		expect(approval.decision).toBe("AUTO_APPROVED");
		expect(approval.approvalSource).toBe("SYSTEM");
		expect(approval.stepKey).toBe("RECURRING_AUTHORIZATION");

		expect(result.idempotentReplay).toBe(false);
		vi.useRealTimers();
	});

	it("returns the existing occurrence when a claim already exists (idempotent)", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindOccurrence.mockResolvedValue({ id: "LR-EXISTING" });

		const { leaveRepository } = await import(
			"@/db/repositories/leave/leave.repository"
		);
		(leaveRepository.findById as any).mockResolvedValue({
			id: "LR-EXISTING",
			requestNumber: "LR-100",
			startAt: new Date(),
			endAt: new Date(),
		});

		const result = await claimLateStayOccurrence("AUTH1", {}, USER);

		expect(mockLeaveCreate).not.toHaveBeenCalled();
		expect(result.idempotentReplay).toBe(true);
		expect(result.occurrenceId).toBe("LR-EXISTING");
		vi.useRealTimers();
	});

	it("rejects a claim when the authorization does not cover now", async () => {
		// Sunday evening — outside Mon–Fri.
		vi.useFakeTimers({ now: new Date("2026-09-27T20:00:00Z") });

		await expect(claimLateStayOccurrence("AUTH1", {}, USER)).rejects.toThrow(
			/does not cover/
		);
		expect(mockLeaveCreate).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("rejects a claim when the authorization is revoked", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindByIdForUpdate.mockResolvedValue({
			...ACTIVE_AUTH,
			status: LATE_STAY_AUTH_STATUS.REVOKED,
		});

		await expect(claimLateStayOccurrence("AUTH1", {}, USER)).rejects.toThrow(
			/no longer active/
		);
		vi.useRealTimers();
	});

	it("rejects another student's authorization", async () => {
		mockFindById.mockResolvedValue({
			...ACTIVE_AUTH,
			studentId: "S-OTHER",
		});

		await expect(claimLateStayOccurrence("AUTH1", {}, USER)).rejects.toThrow(
			/Not your authorization/
		);
	});

	it("rejects an off-day claim attempt", async () => {
		await expect(
			claimLateStayOccurrence("AUTH1", { date: "2026-09-25" }, USER)
		).rejects.toThrow(/only be claimed on the day/);
	});
});

describe("getLateStayClaimEligibility", () => {
	it("reports eligible with the covering authorization on a covered evening", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindActiveForStudentForUpdate.mockResolvedValue([ACTIVE_AUTH]);

		const eligibility = await getLateStayClaimEligibility(USER);

		expect(eligibility.eligible).toBe(true);
		expect(eligibility.authorization?.id).toBe("AUTH1");
		vi.useRealTimers();
	});

	it("reports NOT_COVERED outside the window", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T12:00:00Z") });
		mockFindActiveForStudentForUpdate.mockResolvedValue([ACTIVE_AUTH]);

		const eligibility = await getLateStayClaimEligibility(USER);

		expect(eligibility.eligible).toBe(false);
		expect(eligibility.reason).toBe("NOT_COVERED");
		vi.useRealTimers();
	});

	it("reports ALREADY_CLAIMED when tonight's occurrence exists", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-22T20:15:00Z") });
		mockFindActiveForStudentForUpdate.mockResolvedValue([ACTIVE_AUTH]);
		mockFindOccurrence.mockResolvedValue({ id: "LR-EXISTING" });

		const eligibility = await getLateStayClaimEligibility(USER);

		expect(eligibility.eligible).toBe(false);
		expect(eligibility.reason).toBe("ALREADY_CLAIMED");
		expect(eligibility.alreadyClaimed?.id).toBe("LR-EXISTING");
		vi.useRealTimers();
	});
});

describe("assertNoActiveAuthorizationCoverage", () => {
	it("rejects a manual application fully covered by an active authorization", async () => {
		mockFindActiveByStudent.mockResolvedValue([ACTIVE_AUTH]);

		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-23T18:30:00Z"),
				endAt: new Date("2026-09-23T21:30:00Z"),
			})
		).rejects.toThrow(/active recurring late-stay authorization/);
	});

	it("allows a manual application outside authorization coverage", async () => {
		mockFindActiveByStudent.mockResolvedValue([ACTIVE_AUTH]);

		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-27T18:30:00Z"),
				endAt: new Date("2026-09-27T21:30:00Z"),
			})
		).resolves.toBeUndefined();
	});

	it("passes with no active authorizations", async () => {
		await expect(
			assertNoActiveAuthorizationCoverage({
				studentId: "S1",
				leaveTypeId: "LT1",
				startAt: new Date("2026-09-23T18:30:00Z"),
				endAt: new Date("2026-09-23T21:30:00Z"),
			})
		).resolves.toBeUndefined();
	});
});
