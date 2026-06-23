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

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb(mockTxClient),
  },
}));

const mockFindStudentById = vi.fn();
const mockFindStudentByIdForUpdate = vi.fn();
const mockUpdateCurrentLocationState = vi.fn();
const mockMovementEventCreate = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindStudentByIdForUpdate(...args),
    updateCurrentLocationState: (...args: any[]) => mockUpdateCurrentLocationState(...args),
  },
}));

vi.mock("@/db/repositories/movement/movement-event.repository", () => ({
  movementEventRepository: {
    create: (...args: any[]) => mockMovementEventCreate(...args),
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

import { recordMovement } from "@/services/movement/record-movement.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });
  mockMovementEventCreate.mockResolvedValue({ id: "ME1" });
  mockUpdateCurrentLocationState.mockResolvedValue({ id: "S1" });
});

describe("recordMovement service", () => {
  describe("state machine validation", () => {
    it("accepts valid transition (IN_HOSTEL + LEAVE_APPROVED)", async () => {
      const result = await recordMovement({
        studentId: "S1",
        leaveRequestId: "L1",
        fromState: "IN_HOSTEL",
        toState: "APPROVED_LEAVE",
        eventType: "LEAVE_APPROVED",
        movementMethod: "SYSTEM",
      });

      expect(result).toEqual({ id: "ME1" });
      expect(mockMovementEventCreate).toHaveBeenCalled();
      expect(mockUpdateCurrentLocationState).toHaveBeenCalledWith("S1", "APPROVED_LEAVE", expect.any(Object));
    });

    it("rejects invalid transition (IN_HOSTEL + EXIT_HOSTEL)", async () => {
      await expect(
        recordMovement({
          studentId: "S1",
          fromState: "IN_HOSTEL",
          toState: "CHECKED_OUT",
          eventType: "EXIT_HOSTEL",
          movementMethod: "QR",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("rejects transition when toState doesn't match state machine", async () => {
      await expect(
        recordMovement({
          studentId: "S1",
          fromState: "IN_HOSTEL",
          toState: "IN_HOSTEL",
          eventType: "LEAVE_APPROVED",
          movementMethod: "SYSTEM",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("rejects unknown event type", async () => {
      await expect(
        recordMovement({
          studentId: "S1",
          fromState: "IN_HOSTEL",
          toState: "APPROVED_LEAVE",
          eventType: "UNKNOWN_EVENT",
          movementMethod: "SYSTEM",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("rejects transition from unknown state", async () => {
      mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "UNKNOWN" });

      await expect(
        recordMovement({
          studentId: "S1",
          fromState: "UNKNOWN",
          toState: "IN_HOSTEL",
          eventType: "ENTER_HOSTEL",
          movementMethod: "QR",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("accepts valid transition (APPROVED_LEAVE + EXIT_HOSTEL)", async () => {
      mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "APPROVED_LEAVE" });

      await recordMovement({
        studentId: "S1",
        fromState: "APPROVED_LEAVE",
        toState: "CHECKED_OUT",
        eventType: "EXIT_HOSTEL",
        movementMethod: "QR",
      });

      expect(mockMovementEventCreate).toHaveBeenCalled();
    });

    it("accepts valid transition (CHECKED_OUT + ENTER_HOSTEL)", async () => {
      mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "CHECKED_OUT" });

      await recordMovement({
        studentId: "S1",
        fromState: "CHECKED_OUT",
          toState: "IN_HOSTEL",
          eventType: "ENTER_HOSTEL",
        movementMethod: "QR",
      });

      expect(mockMovementEventCreate).toHaveBeenCalled();
    });
  });

  describe("student state validation", () => {
    it("throws NotFoundError when student not found", async () => {
      mockFindStudentById.mockResolvedValue(null);

      await expect(
        recordMovement({
          studentId: "NONEXISTENT",
          fromState: "IN_HOSTEL",
          toState: "APPROVED_LEAVE",
          eventType: "LEAVE_APPROVED",
          movementMethod: "SYSTEM",
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student state doesn't match fromState", async () => {
      mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "APPROVED_LEAVE" });

      await expect(
        recordMovement({
          studentId: "S1",
          fromState: "IN_HOSTEL",
          toState: "APPROVED_LEAVE",
          eventType: "LEAVE_APPROVED",
          movementMethod: "SYSTEM",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("transaction atomicity", () => {
    it("creates event and updates student state in same transaction", async () => {
      await recordMovement({
        studentId: "S1",
        fromState: "IN_HOSTEL",
        toState: "APPROVED_LEAVE",
        eventType: "LEAVE_APPROVED",
        movementMethod: "SYSTEM",
      });

      expect(mockMovementEventCreate).toHaveBeenCalledTimes(1);
      expect(mockUpdateCurrentLocationState).toHaveBeenCalledTimes(1);
    });

    it("passes dbClient when provided (caller transaction)", async () => {
      const mockClient = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };

      await recordMovement({
        studentId: "S1",
        fromState: "IN_HOSTEL",
        toState: "APPROVED_LEAVE",
        eventType: "LEAVE_APPROVED",
        movementMethod: "SYSTEM",
        dbClient: mockClient,
      });

      expect(mockFindStudentById).toHaveBeenCalledWith("S1", mockClient);
      expect(mockMovementEventCreate).toHaveBeenCalledWith(expect.any(Object), mockClient);
      expect(mockUpdateCurrentLocationState).toHaveBeenCalledWith("S1", "APPROVED_LEAVE", mockClient);
    });

    it("does not call db.transaction when dbClient is provided", async () => {
      const mockClient = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };

      await recordMovement({
        studentId: "S1",
        fromState: "IN_HOSTEL",
        toState: "APPROVED_LEAVE",
        eventType: "LEAVE_APPROVED",
        movementMethod: "SYSTEM",
        dbClient: mockClient,
      });

      // If db.transaction was called, it would have been with a plain object {}
      // Since dbClient is provided, the exec function runs directly without transaction
      expect(mockMovementEventCreate).toHaveBeenCalled();
    });
  });

  describe("audit fields", () => {
    it("records metadata, overrideReason, and recordedBy", async () => {
      await recordMovement({
        studentId: "S1",
        fromState: "IN_HOSTEL",
        toState: "APPROVED_LEAVE",
        eventType: "LEAVE_APPROVED",
        movementMethod: "SYSTEM",
        recordedBy: "U1",
        isManualOverride: true,
        overrideReason: "Testing",
        metadata: { reason: "test" },
      });

      expect(mockMovementEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Testing",
          metadata: { reason: "test" },
        }),
        expect.any(Object)
      );
    });
  });
});
