// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTxClient = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([]),
  returning: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb(mockTxClient),
}));

const mockStudentFindById = vi.fn();
const mockStudentFindByIdWithRelations = vi.fn();
const mockRecordMovement = vi.fn();
const mockFindOpenSessionPass = vi.fn();
const mockMarkAsClosed = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockStudentFindById(...args),
    findByIdWithRelations: (...args: any[]) => mockStudentFindByIdWithRelations(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findOpenSessionPassForStudent: (...args: any[]) =>
      mockFindOpenSessionPass(...args),
    markAsClosed: (...args: any[]) => mockMarkAsClosed(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
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

import { manualReturn } from "@/services/movement/manual-return.service";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";

const SUPER_ADMIN_USER = { id: "U1", roles: ["SUPER_ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockMarkAsClosed.mockResolvedValue({ id: "PASS1" });
  mockFindOpenSessionPass.mockResolvedValue(null);
  mockStudentFindByIdWithRelations.mockResolvedValue(null);
});

const OUTSIDE_STUDENT = {
  id: "S1",
  currentLocationState: "OUTSIDE_HOSTEL",
};

const OPEN_SESSION = {
  id: "PASS1",
  studentId: "S1",
  leaveRequestId: "L1",
  firstScanAt: new Date("2026-06-10T09:30:00Z"),
  closedAt: null,
};

describe("manualReturn service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when student does not exist", async () => {
      mockStudentFindById.mockResolvedValue(null);

      await expect(
        manualReturn({ studentId: "NONEXISTENT", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student is IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await expect(
        manualReturn({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is APPROVED_LEAVE", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "APPROVED_LEAVE",
      });

      await expect(
        manualReturn({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("T9: manual return with an open QR session", () => {
    it("closes the pass, completes the leave, and links the movement event", async () => {
      mockStudentFindById.mockResolvedValue(OUTSIDE_STUDENT);
      mockFindOpenSessionPass.mockResolvedValue(OPEN_SESSION);
      mockLeaveFindById.mockResolvedValue({
        id: "L1",
        status: "APPROVED",
      });

      const result = await manualReturn({
        studentId: "S1",
        currentUser: SUPER_ADMIN_USER,
        reason: "Security override",
      });

      // Movement event carries the session linkage for history reconstruction
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          leaveRequestId: "L1",
          qrPassId: "PASS1",
          fromState: "OUTSIDE_HOSTEL",
          toState: "IN_HOSTEL",
          eventType: "MANUAL_RETURN",
          movementMethod: "MANUAL",
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Security override",
          dbClient: expect.any(Object),
        })
      );

      // Session closed — no phantom open pass
      expect(mockMarkAsClosed).toHaveBeenCalledWith("PASS1", mockTxClient);

      // Leave completed with actualReturnAt = now
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "L1",
        expect.objectContaining({
          status: "COMPLETED",
          actualReturnAt: expect.any(Date),
          currentStepKey: null,
          currentStepOrder: null,
        }),
        mockTxClient
      );

      expect(mockOutboxPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "LEAVE_COMPLETED",
          aggregateId: "L1",
          payload: expect.objectContaining({
            leaveId: "L1",
            studentId: "S1",
            method: "MANUAL_RETURN",
          }),
        }),
        mockTxClient
      );

      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "L1",
        "U1",
        expect.objectContaining({
          oldStatus: "APPROVED",
          newStatus: "COMPLETED",
        }),
        mockTxClient
      );

      expect(result).toEqual({
        movementEventId: "ME1",
        studentId: "S1",
        newState: "IN_HOSTEL",
        leaveId: "L1",
      });
    });

    it("completes an OVERDUE leave (T8/T9 return path)", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OVERDUE",
      });
      mockFindOpenSessionPass.mockResolvedValue(OPEN_SESSION);
      mockLeaveFindById.mockResolvedValue({
        id: "L1",
        status: "OVERDUE",
      });

      const result = await manualReturn({
        studentId: "S1",
        currentUser: SUPER_ADMIN_USER,
      });

      expect(result.newState).toBe("IN_HOSTEL");
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OVERDUE",
          toState: "IN_HOSTEL",
          leaveRequestId: "L1",
          qrPassId: "PASS1",
        })
      );
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "L1",
        expect.objectContaining({ status: "COMPLETED" }),
        mockTxClient
      );
    });

    it("does not re-complete a leave already closed", async () => {
      mockStudentFindById.mockResolvedValue(OUTSIDE_STUDENT);
      mockFindOpenSessionPass.mockResolvedValue(OPEN_SESSION);
      // Leave already COMPLETED (stale open pass from a legacy row): the
      // return must still close the session without double-completing.
      mockLeaveFindById.mockResolvedValue({
        id: "L1",
        status: "COMPLETED",
      });

      await manualReturn({ studentId: "S1", currentUser: SUPER_ADMIN_USER });

      expect(mockMarkAsClosed).toHaveBeenCalledWith("PASS1", mockTxClient);
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
      expect(mockOutboxPublish).not.toHaveBeenCalled();
    });
  });

  describe("manual return without a QR session (legacy CHECKED_OUT / manual checkout)", () => {
    it("records the movement only, no leave completion", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });
      mockFindOpenSessionPass.mockResolvedValue(null);

      const result = await manualReturn({
        studentId: "S1",
        currentUser: SUPER_ADMIN_USER,
        reason: "Security override",
      });

      expect(result).toEqual({
        movementEventId: "ME1",
        studentId: "S1",
        newState: "IN_HOSTEL",
        leaveId: null,
      });
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          fromState: "CHECKED_OUT",
          toState: "IN_HOSTEL",
          eventType: "MANUAL_RETURN",
          movementMethod: "MANUAL",
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Security override",
          dbClient: expect.any(Object),
        })
      );
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
      expect(mockOutboxPublish).not.toHaveBeenCalled();
    });

    it("records movement from OUTSIDE_HOSTEL to IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue(OUTSIDE_STUDENT);

      await manualReturn({
        studentId: "S1",
        currentUser: SUPER_ADMIN_USER,
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OUTSIDE_HOSTEL",
          toState: "IN_HOSTEL",
        })
      );
    });

    it("records movement from OVERDUE to IN_HOSTEL without a session", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OVERDUE",
      });

      await manualReturn({
        studentId: "S1",
        currentUser: SUPER_ADMIN_USER,
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OVERDUE",
          toState: "IN_HOSTEL",
        })
      );
    });
  });

  describe("transaction atomicity", () => {
    it("propagates recordMovement failure", async () => {
      mockStudentFindById.mockResolvedValue(OUTSIDE_STUDENT);
      mockFindOpenSessionPass.mockResolvedValue(OPEN_SESSION);
      mockLeaveFindById.mockResolvedValue({ id: "L1", status: "APPROVED" });
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        manualReturn({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("hostel-scope enforcement", () => {
    it("rejects a hostel-scoped admin returning a student from another hostel", async () => {
      mockStudentFindById.mockResolvedValue(OUTSIDE_STUDENT);

      mockStudentFindByIdWithRelations.mockResolvedValue({
        student: { id: "S1" },
        user: { hostelId: "H2" },
        locationState: null,
      });

      const scopedAdmin = {
        id: "U9",
        roles: ["ADMIN"],
        roleScopes: [
          { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
        ],
      };

      await expect(
        manualReturn({ studentId: "S1", currentUser: scopedAdmin })
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });
  });
});
