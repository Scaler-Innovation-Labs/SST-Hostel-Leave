// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

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
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

const mockFindByLeaveRequestId = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveTypeFindById = vi.fn();
const mockStudentFindByUserId = vi.fn();
const mockQrPassCreate = vi.fn();
const mockQrPassRegenerate = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindByLeaveRequestId(...args),
    create: (...args: any[]) => mockQrPassCreate(...args),
    regenerate: (...args: any[]) => mockQrPassRegenerate(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockStudentFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
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

import { generateQrPass } from "@/services/movement/generate-qr.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

const VALID_INPUT = {
  leaveRequestId: "LR1",
  studentId: "S1",
  userId: "U1",
  qrType: "LEAVE_EXIT",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByLeaveRequestId.mockResolvedValue(null);
  mockStudentFindByUserId.mockResolvedValue({ id: "S1" });
  mockLeaveTypeFindById.mockResolvedValue({ id: "LT1", qrMode: "EXIT_ONLY" });
  mockLeaveFindById.mockResolvedValue({
    id: "LR1",
    studentId: "S1",
    leaveTypeId: "LT1",
    status: "APPROVED",
  });
  mockQrPassCreate.mockResolvedValue({
    id: "QP1",
    tokenHash: "abc123",
    qrType: "LEAVE_EXIT",
    expiresAt: null,
  });
});

describe("generateQrPass service", () => {
  describe("precondition validation", () => {
    it("returns existing pass when an active pass already exists (no token since not stored in DB)", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-EXISTING",
        status: "ACTIVE",
        tokenHash: "existing-hash",
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });

      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP-EXISTING");
      expect(result.token).toBe("");
      expect(mockFindByLeaveRequestId).toHaveBeenCalledWith("LR1", expect.any(Object));
      expect(mockQrPassCreate).not.toHaveBeenCalled();
    });

    it("regenerates pass when existing pass is not active", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-INVALIDATED",
        status: "INVALIDATED",
        tokenHash: "old-hash",
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });
      mockQrPassRegenerate.mockResolvedValue({
        id: "QP-INVALIDATED",
        tokenHash: "new-hash",
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });

      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP-INVALIDATED");
      expect(mockQrPassRegenerate).toHaveBeenCalled();
      expect(mockQrPassCreate).not.toHaveBeenCalled();
    });
  });

  describe("leave request validation", () => {
    it("throws NotFoundError when leave request does not exist", async () => {
      mockLeaveFindById.mockResolvedValue(null);

      await expect(
        generateQrPass(VALID_INPUT)
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ValidationError when leave is not APPROVED", async () => {
      mockLeaveFindById.mockResolvedValue({
        id: "LR1",
        studentId: "S1",
        leaveTypeId: "LT1",
        status: "PENDING",
      });

      await expect(
        generateQrPass(VALID_INPUT)
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("QR pass creation", () => {
    it("creates QR pass with generated token", async () => {
      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP1");
      expect(result.token).toBeTruthy();
      expect(result.token.length).toBe(64); // 32 bytes hex = 64 chars
      expect(result.qrType).toBe("LEAVE_EXIT");
      expect(mockQrPassCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveRequestId: "LR1",
          studentId: "S1",
          qrType: "LEAVE_EXIT",
          status: "ACTIVE",
          tokenHash: expect.any(String),
        }),
        expect.any(Object)
      );
    });

    it("returns the raw token only at generation time (not stored in DB)", async () => {
      const result = await generateQrPass(VALID_INPUT);

      const createCall = mockQrPassCreate.mock.calls[0][0];
      // tokenHash is stored, rawToken is not — raw returned only in response
      expect(createCall.tokenHash).not.toBe(result.token);
      expect(createCall.rawToken).toBeUndefined();
      // Returned token is 64-char hex
      expect(result.token.length).toBe(64);
    });

    it("passes optional expiresAt when provided", async () => {
      const expiresAt = new Date("2026-07-01");

      await generateQrPass({
        ...VALID_INPUT,
        expiresAt,
      });

      expect(mockQrPassCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt,
        }),
        expect.any(Object)
      );
    });
  });

  describe("audit logging", () => {
    it("records audit on successful QR generation", async () => {
      await generateQrPass(VALID_INPUT);

      expect(mockAuditRecord).toHaveBeenCalledWith(
        "CREATE",
        "QR_PASS",
        "QP1",
        "U1",
        expect.objectContaining({
          qrType: "LEAVE_EXIT",
          leaveRequestId: "LR1",
        }),
        expect.any(Object)
      );
    });
  });

  describe("outbox dispatch", () => {
    it("publishes QR_GENERATED event", async () => {
      await generateQrPass(VALID_INPUT);

      expect(mockOutboxPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "QR_GENERATED",
          aggregateType: "QR_PASS",
          aggregateId: "QP1",
          payload: expect.objectContaining({
            qrPassId: "QP1",
            leaveRequestId: "LR1",
            studentId: "S1",
            qrType: "LEAVE_EXIT",
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("transaction atomicity", () => {
    it("creates QR, audit, and outbox in same transaction", async () => {
      await generateQrPass(VALID_INPUT);

      expect(mockQrPassCreate).toHaveBeenCalledTimes(1);
      expect(mockAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockOutboxPublish).toHaveBeenCalledTimes(1);
    });

    it("propagates create failure", async () => {
      mockQrPassCreate.mockRejectedValue(new Error("DB error"));

      await expect(
        generateQrPass(VALID_INPUT)
      ).rejects.toThrow("DB error");
    });
  });
});
