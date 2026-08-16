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

const mockQrPassFindById = vi.fn();
const mockQrPassInvalidate = vi.fn();
const mockStudentFindById = vi.fn();
const mockRecordMovement = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findById: (...args: any[]) => mockQrPassFindById(...args),
    invalidate: (...args: any[]) => mockQrPassInvalidate(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockStudentFindById(...args),
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
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { invalidateQrPass } from "@/services/movement/invalidate-qr.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

const VALID_PASS = {
  id: "QP1",
  studentId: "S1",
  leaveRequestId: "LR1",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockQrPassFindById.mockResolvedValue(VALID_PASS);
  mockQrPassInvalidate.mockResolvedValue({ id: "QP1", status: "INVALIDATED" });
  mockStudentFindById.mockResolvedValue({
    id: "S1",
    currentLocationState: "APPROVED_LEAVE",
  });
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
});

describe("invalidateQrPass service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when QR pass does not exist", async () => {
      mockQrPassFindById.mockResolvedValue(null);

      await expect(
        invalidateQrPass({ qrPassId: "NONEXISTENT", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when QR pass is not ACTIVE", async () => {
      mockQrPassFindById.mockResolvedValue({
        ...VALID_PASS,
        status: "USED",
      });

      await expect(
        invalidateQrPass({ qrPassId: "QP1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("invalidation with movement", () => {
    it("invalidates QR pass and records movement when student is APPROVED_LEAVE", async () => {
      const result = await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
        reason: "Student changed plans",
      });

      expect(result.qrPassId).toBe("QP1");
      expect(result.movementEventId).toBe("ME1");
      expect(mockQrPassInvalidate).toHaveBeenCalledWith("QP1", expect.any(Object));
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          leaveRequestId: "LR1",
          qrPassId: "QP1",
          fromState: "APPROVED_LEAVE",
          toState: "IN_HOSTEL",
          eventType: "QR_INVALIDATED",
          movementMethod: "SYSTEM",
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Student changed plans",
          dbClient: expect.any(Object),
        })
      );
    });

    it("does not record movement when student is not APPROVED_LEAVE", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      const result = await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
      });

      expect(result.qrPassId).toBe("QP1");
      expect(result.movementEventId).toBeUndefined();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });
  });

  describe("audit logging", () => {
    it("records audit on invalidation", async () => {
      await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
        reason: "Admin action",
      });

      expect(mockAuditRecord).toHaveBeenCalledWith(
        "INVALIDATE",
        "QR_PASS",
        "QP1",
        "U1",
        expect.objectContaining({
          reason: "Admin action",
          leaveRequestId: "LR1",
          studentId: "S1",
          movementEventId: "ME1",
        }),
        expect.any(Object)
      );
    });

    it("records audit with null movementEventId when no movement", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
      });

      expect(mockAuditRecord).toHaveBeenCalledWith(
        "INVALIDATE",
        "QR_PASS",
        "QP1",
        "U1",
        expect.objectContaining({
          movementEventId: undefined,
        }),
        expect.any(Object)
      );
    });
  });

  describe("transaction atomicity", () => {
    it("performs all operations in same transaction", async () => {
      await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
      });

      expect(mockQrPassInvalidate).toHaveBeenCalledTimes(1);
      expect(mockRecordMovement).toHaveBeenCalledTimes(1);
      expect(mockAuditRecord).toHaveBeenCalledTimes(1);
    });

    it("propagates recordMovement failure", async () => {
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        invalidateQrPass({
          qrPassId: "QP1",
          recordedBy: "U1",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("outbox publication", () => {
    it("publishes a QR_INVALIDATED outbox event", async () => {
      await invalidateQrPass({
        qrPassId: "QP1",
        recordedBy: "U1",
      });

      expect(mockOutboxPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "QR_INVALIDATED",
          aggregateType: "QR_PASS",
          aggregateId: "QP1",
          payload: expect.objectContaining({
            studentId: "S1",
            leaveRequestId: "LR1",
            qrPassId: "QP1",
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("ownership guard", () => {
    it("blocks a student from invalidating another student's pass", async () => {
      await expect(
        invalidateQrPass({
          qrPassId: "QP1",
          recordedBy: "SOMEONE_ELSE",
          isOwnerOnly: true,
        })
      ).rejects.toBeInstanceOf(ConflictError);

      expect(mockQrPassInvalidate).not.toHaveBeenCalled();
    });

    it("allows a student to invalidate their own pass", async () => {
      await expect(
        invalidateQrPass({
          qrPassId: "QP1",
          recordedBy: "S1",
          isOwnerOnly: true,
        })
      ).resolves.toEqual({ qrPassId: "QP1", movementEventId: "ME1" });
    });
  });
});
