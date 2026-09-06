// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

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
const mockFindUsableExitPass = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindByLeaveRequestId(...args),
    create: (...args: any[]) => mockQrPassCreate(...args),
    regenerate: (...args: any[]) => mockQrPassRegenerate(...args),
    findUsableExitPassForStudent: (...args: any[]) => mockFindUsableExitPass(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByIdForUpdate: (...args: any[]) => mockLeaveFindById(...args),
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
import { encryptQrToken } from "@/lib/qr-token-crypto";

const TEST_ENC_KEY = "ab".repeat(32);

const VALID_INPUT = {
  leaveRequestId: "LR1",
  studentId: "S1",
  userId: "U1",
  qrType: "LEAVE_EXIT",
};

let stableTokenEnc: string;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv("QR_TOKEN_ENC_KEY", TEST_ENC_KEY);
  stableTokenEnc = await encryptQrToken("stable-token");
  mockFindByLeaveRequestId.mockResolvedValue(null);
  mockFindUsableExitPass.mockResolvedValue(null);
  mockStudentFindByUserId.mockResolvedValue({ id: "S1" });
  mockLeaveTypeFindById.mockResolvedValue({ id: "LT1", qrMode: "EXIT_ONLY" });
  mockLeaveFindById.mockResolvedValue({
    id: "LR1",
    studentId: "S1",
    leaveTypeId: "LT1",
    status: "APPROVED",
    startAt: new Date("2026-06-10T00:00:00Z"),
    endAt: new Date("2026-06-12T00:00:00Z"),
  });
  mockQrPassCreate.mockResolvedValue({
    id: "QP1",
    tokenHash: "abc123",
    qrType: "LEAVE_EXIT",
    expiresAt: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateQrPass service", () => {
  describe("precondition validation", () => {
    it("returns the existing active pass as-is (one QR per leave, no re-issue)", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-EXISTING",
        status: "ACTIVE",
        tokenHash: "existing-hash",
        tokenEnc: stableTokenEnc,
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });

      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP-EXISTING");
      expect(result.tokenHash).toBe("existing-hash");
      // The raw token never leaves the server — the app renders the hosted image.
      expect(result).not.toHaveProperty("token");
      expect(mockFindByLeaveRequestId).toHaveBeenCalledWith("LR1", expect.any(Object));
      expect(mockQrPassCreate).not.toHaveBeenCalled();
      expect(mockQrPassRegenerate).not.toHaveBeenCalled();
    });

    it("writes an encrypted token once for a legacy active pass (repair, not re-issue)", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-LEGACY",
        status: "ACTIVE",
        tokenHash: "old-hash",
        tokenEnc: null,
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });
      mockQrPassRegenerate.mockResolvedValue({
        id: "QP-LEGACY",
        tokenHash: "new-hash",
        qrType: "LEAVE_EXIT",
        expiresAt: null,
      });

      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP-LEGACY");
      expect(result).not.toHaveProperty("token");
      const regenerateInput = mockQrPassRegenerate.mock.calls[0][1];
      expect(regenerateInput.tokenEnc).toMatch(/^v1:/);
      expect(regenerateInput).not.toHaveProperty("token");
      expect(mockQrPassCreate).not.toHaveBeenCalled();
    });

    it("re-issues a fresh encrypted token for an invalidated-but-never-used pass (contract §7)", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-INVALIDATED",
        status: "INVALIDATED",
        tokenHash: "old-hash",
        tokenEnc: null,
        qrType: "LEAVE_EXIT",
        firstScanAt: null,
        closedAt: null,
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
      expect(result).not.toHaveProperty("token");
      const regenerateInput = mockQrPassRegenerate.mock.calls[0][1];
      expect(regenerateInput.tokenEnc).toMatch(/^v1:/);
      expect(regenerateInput).not.toHaveProperty("token");
      expect(mockQrPassCreate).not.toHaveBeenCalled();
    });

    it("does not re-issue a pass that was already used (dead for good)", async () => {
      mockFindByLeaveRequestId.mockResolvedValue({
        id: "QP-USED",
        status: "USED",
        tokenHash: "old-hash",
        tokenEnc: null,
        qrType: "LEAVE_EXIT",
        firstScanAt: new Date("2026-06-10T10:00:00Z"),
        closedAt: new Date("2026-06-12T10:00:00Z"),
        expiresAt: null,
      });

      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP-USED");
      expect(result).not.toHaveProperty("token");
      expect(mockQrPassRegenerate).not.toHaveBeenCalled();
      expect(mockQrPassCreate).not.toHaveBeenCalled();
    });

    it("rejects generation when another usable-for-exit pass exists for the student (contract §7)", async () => {
      mockFindUsableExitPass.mockResolvedValue({
        id: "QP-OTHER",
        status: "ACTIVE",
        tokenHash: "other-hash",
        tokenEnc: null,
        qrType: "LEAVE_EXIT",
      });

      await expect(
        generateQrPass(VALID_INPUT)
      ).rejects.toBeInstanceOf(ValidationError);
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
    it("creates QR pass and returns its id (token stays server-side)", async () => {
      const result = await generateQrPass(VALID_INPUT);

      expect(result.passId).toBe("QP1");
      expect(result).not.toHaveProperty("token");
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

    it("window-gates the new pass (validFrom = startAt, expiresAt = endAt + 24h grace)", async () => {
      await generateQrPass(VALID_INPUT);

      const createCall = mockQrPassCreate.mock.calls[0][0];
      expect(createCall.validFrom.toISOString()).toBe("2026-06-10T00:00:00.000Z");
      expect(createCall.expiresAt.toISOString()).toBe("2026-06-13T00:00:00.000Z"); // endAt + 24h
    });

    it("stores only hash + encrypted envelope, never the plaintext token", async () => {
      await generateQrPass(VALID_INPUT);

      const createCall = mockQrPassCreate.mock.calls[0][0];
      // No plaintext bearer credential reaches the database: the hash
      // authenticates gate scans, the envelope reconstructs the QR image.
      expect(createCall.token).toBeUndefined();
      expect(createCall.tokenEnc).toMatch(/^v1:/);
      expect(typeof createCall.tokenHash).toBe("string");
    });

    it("ignores any client-supplied expiry and derives it from the leave window", async () => {
      // Client-controlled expiry is not part of the input contract anymore;
      // even if supplied it must be ignored server-side (the field is read
      // from the leave window, never from the request).
      await generateQrPass({
        ...VALID_INPUT,
        expiresAt: new Date("2030-01-01"),
      });

      const createCall = mockQrPassCreate.mock.calls[0][0];
      // Derived from leave endAt + 24h grace, never the client value.
      expect(createCall.expiresAt.toISOString()).toBe("2026-06-13T00:00:00.000Z");
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
