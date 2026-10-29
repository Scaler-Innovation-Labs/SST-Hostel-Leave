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

const mockFindByTokenHash = vi.fn();
const mockFindById = vi.fn();
const mockFindUsableExitPass = vi.fn();
const mockFindOpenSessionPass = vi.fn();
const mockMarkAsFirstScanned = vi.fn();
const mockMarkAsClosed = vi.fn();
const mockInvalidate = vi.fn();
const mockScanLogCreate = vi.fn();
const mockRecordMovement = vi.fn();
const mockStudentFindById = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});
const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveUpdateById = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByTokenHash: (...args: any[]) => mockFindByTokenHash(...args),
    findById: (...args: any[]) => mockFindById(...args),
    findUsableExitPassForStudent: (...args: any[]) => mockFindUsableExitPass(...args),
    findOpenSessionPassForStudent: (...args: any[]) => mockFindOpenSessionPass(...args),
    markAsFirstScanned: (...args: any[]) => mockMarkAsFirstScanned(...args),
    markAsClosed: (...args: any[]) => mockMarkAsClosed(...args),
    invalidate: (...args: any[]) => mockInvalidate(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-scan-log.repository", () => ({
  qrScanLogRepository: {
    create: (...args: any[]) => mockScanLogCreate(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockStudentFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
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

import { scanQrPass } from "@/services/movement/scan-qr.service";
import { ConflictError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockScanLogCreate.mockResolvedValue({ id: "LOG1" });
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockMarkAsFirstScanned.mockResolvedValue({ id: "PASS1" });
  mockMarkAsClosed.mockResolvedValue({ id: "PASS1" });
  mockInvalidate.mockResolvedValue({ id: "PASS1" });
  mockFindUsableExitPass.mockResolvedValue(null);
  mockFindOpenSessionPass.mockResolvedValue(null);
  mockFindById.mockResolvedValue({
    id: "PASS1",
    status: "ACTIVE",
    qrType: "LEAVE_RETURN",
  });
  mockLeaveFindById.mockResolvedValue(null);
  mockLeaveFindByIdForUpdate.mockResolvedValue({
    id: "L1",
    status: "APPROVED",
  });
  mockStudentFindById.mockResolvedValue({
    id: "S1",
    currentLocationState: "CHECKED_OUT",
  });
});

const VALID_PASS = {
  id: "PASS1",
  studentId: "S1",
  leaveRequestId: "L1",
  qrType: "LEAVE_EXIT",
  status: "ACTIVE",
  expiresAt: null,
};

const VALID_RETURN_PASS = {
  id: "PASS2",
  studentId: "S1",
  leaveRequestId: "L1",
  qrType: "LEAVE_RETURN",
  status: "ACTIVE",
  expiresAt: null,
  firstScanAt: new Date("2026-06-12T14:50:43Z"),
};

describe("scanQrPass service", () => {
  describe("token validation", () => {
    it("returns failure when token not found", async () => {
      mockFindByTokenHash.mockResolvedValue(null);

      const result = await scanQrPass({
        token: "nonexistent",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR token not found");
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ qrPassId: null, scanResult: "FAILED" })
      );
    });

    it("returns failure when pass is not ACTIVE", async () => {
      mockFindByTokenHash.mockResolvedValue({ ...VALID_PASS, status: "USED" });

      const result = await scanQrPass({
        token: "valid-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("QR pass status is USED");
    });

    it("invalidates expired pass and returns failure", async () => {
      const expiredPass = {
        ...VALID_PASS,
        expiresAt: new Date("2020-01-01"),
      };
      mockFindByTokenHash.mockResolvedValue(expiredPass);

      const result = await scanQrPass({
        token: "expired-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR pass has expired");
      expect(mockInvalidate).toHaveBeenCalledWith("PASS1");
    });

    it("rejects EXIT_SCAN before the pass is valid (future leave window)", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        validFrom: new Date("2099-01-01"),
        expiresAt: null,
      });

      const result = await scanQrPass({
        token: "future-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("QR pass is not valid until");
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ scanResult: "FAILED" })
      );
    });

    it("rejects an EXIT_SCAN on a RETURN_ONLY pass", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe(
        "Return-only QR cannot be used for exit"
      );
      expect(mockMarkAsFirstScanned).not.toHaveBeenCalled();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("rejects EXIT_SCAN when another usable-for-exit pass exists for the student", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockFindUsableExitPass.mockResolvedValue({ id: "PASS-OTHER" });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("Another active QR exists for a conflicting leave");
      expect(mockMarkAsFirstScanned).not.toHaveBeenCalled();
    });

    it("rejects EXIT_SCAN when the student already has an open movement session", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockFindOpenSessionPass.mockResolvedValue({
        id: "PASS-OPEN",
        leaveRequestId: "L1",
        firstScanAt: new Date(),
        closedAt: null,
      });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe(
        "Student already has an open movement session"
      );
      expect(mockMarkAsFirstScanned).not.toHaveBeenCalled();
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ scanResult: "FAILED" })
      );
    });
  });

  describe("timestamp validation", () => {
    it("fails EXIT_SCAN when pass already has firstScanAt", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        firstScanAt: new Date(),
      });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR pass has already been used for exit");
    });

    it("fails RETURN_SCAN when pass already has closedAt", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_RETURN_PASS,
        closedAt: new Date(),
      });

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR pass has already been used for return");
    });

    it("fails RETURN_SCAN when pass has no firstScanAt (not exited)", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("Student has not exited yet");
    });
  });

  describe("EXIT_SCAN flow", () => {
    it("creates scan log, marks pass, and records movement from IN_HOSTEL in transaction (contract T4)", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockStudentFindById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(true);
      expect(result.movementEventId).toBe("ME1");
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          qrPassId: "PASS1",
          scanResult: "SUCCESS",
          scanType: "EXIT_SCAN",
        }),
        expect.any(Object)
      );
      expect(mockMarkAsFirstScanned).toHaveBeenCalledWith("PASS1", expect.any(Object));
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          leaveRequestId: "L1",
          qrPassId: "PASS1",
          fromState: "IN_HOSTEL",
          toState: "OUTSIDE_HOSTEL",
          eventType: "EXIT_HOSTEL",
          movementMethod: "QR",
          recordedBy: "U1",
          dbClient: expect.any(Object),
        })
      );
    });

    it("allows EXIT_SCAN on the leaving date even before validFrom time of day", async () => {
      vi.useFakeTimers();
      // 09:30 AM IST on 2026-06-15 (04:00:00.000Z)
      vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));
      try {
        const pass = {
          ...VALID_PASS,
          // 18:00 IST on 2026-06-15 (12:30:00.000Z)
          validFrom: new Date("2026-06-15T12:30:00.000Z"),
        };
        mockFindByTokenHash.mockResolvedValue(pass);
        mockFindById.mockResolvedValue(pass);
        mockStudentFindById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });

        const result = await scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        });

        expect(result.success).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("allows EXIT_SCAN till the day before return date, and rejects on the return date", async () => {
      vi.useFakeTimers();
      // Day before return date: 2026-06-14 18:00 IST (12:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-14T12:30:00.000Z"));
      try {
        const pass = {
          ...VALID_PASS,
          validFrom: new Date("2026-06-10T04:30:00.000Z"),
        };
        mockFindByTokenHash.mockResolvedValue(pass);
        mockFindById.mockResolvedValue(pass);
        mockLeaveFindById.mockResolvedValue({
          id: "L1",
          status: "APPROVED",
          startAt: new Date("2026-06-10T04:30:00.000Z"),
          endAt: new Date("2026-06-15T14:30:00.000Z"),
        });
        mockLeaveFindByIdForUpdate.mockResolvedValue({
          id: "L1",
          status: "APPROVED",
          startAt: new Date("2026-06-10T04:30:00.000Z"),
          endAt: new Date("2026-06-15T14:30:00.000Z"),
        });
        mockStudentFindById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });

        const dayBeforeResult = await scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        });

        expect(dayBeforeResult.success).toBe(true);

        // On return date: 2026-06-15 09:00 IST (03:30:00.000Z)
        vi.setSystemTime(new Date("2026-06-15T03:30:00.000Z"));
        const returnDateResult = await scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        });

        expect(returnDateResult.success).toBe(false);
        expect(returnDateResult.failureReason).toBe("QR pass has expired");
      } finally {
        vi.useRealTimers();
      }
    });

    it("derives fromState from the student's actual location (legacy APPROVED_LEAVE bridge)", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockStudentFindById.mockResolvedValue({ id: "S1", currentLocationState: "APPROVED_LEAVE" });

      await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: "APPROVED_LEAVE", toState: "OUTSIDE_HOSTEL" })
      );
    });

    it("rechecks the window inside the transaction", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockFindById.mockResolvedValue({
        ...VALID_PASS,
        expiresAt: new Date("2020-01-01"),
      });

      await expect(
        scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockMarkAsFirstScanned).not.toHaveBeenCalled();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("lets recordMovement reject an exit while the student is already outside", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockStudentFindById.mockResolvedValue({ id: "S1", currentLocationState: "OUTSIDE_HOSTEL" });

      await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      // fromState must mirror the student's real state so the state machine
      // rejects OUTSIDE_HOSTEL + EXIT_HOSTEL.
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: "OUTSIDE_HOSTEL", toState: "OUTSIDE_HOSTEL" })
      );
    });
  });

  describe("RETURN_SCAN flow", () => {
    it("rejects the return scan after the return date has passed (expired pass)", async () => {
      // Return date has ended — the student is overdue, and overdue returns
      // must be handled via manual movement rather than an expired QR pass.
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_RETURN_PASS,
        expiresAt: new Date("2020-01-01"),
      });

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR pass has expired");
      expect(mockInvalidate).toHaveBeenCalledWith("PASS2");
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          qrPassId: "PASS2",
          scanResult: "FAILED",
          scanType: "RETURN_SCAN",
          failureReason: "QR pass has expired",
        })
      );
    });

    it("allows the return scan from the leave date through the return date", async () => {
      vi.useFakeTimers();
      // On return date: 2026-08-22 18:00 IST (12:30:00.000Z)
      vi.setSystemTime(new Date("2026-08-22T12:30:00.000Z"));
      try {
        mockFindByTokenHash.mockResolvedValue({
          ...VALID_RETURN_PASS,
        });
        mockLeaveFindById.mockResolvedValue({
          id: "L1",
          status: "APPROVED",
          startAt: new Date("2026-08-20T04:30:00.000Z"),
          endAt: new Date("2026-08-22T14:30:00.000Z"),
        });
        mockLeaveFindByIdForUpdate.mockResolvedValue({
          id: "L1",
          status: "APPROVED",
          startAt: new Date("2026-08-20T04:30:00.000Z"),
          endAt: new Date("2026-08-22T14:30:00.000Z"),
        });

        const result = await scanQrPass({
          token: "return-token",
          scannedBy: "U1",
          scanType: "RETURN_SCAN",
        });

        expect(result.success).toBe(true);
        expect(mockMarkAsClosed).toHaveBeenCalledWith("PASS2", expect.any(Object));
        expect(mockRecordMovement).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: "ENTER_HOSTEL", toState: "IN_HOSTEL" })
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("creates scan log, marks pass closed, records movement, and completes leave", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(true);
      expect(result.movementEventId).toBe("ME1");
      expect(mockScanLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          qrPassId: "PASS2",
          scanResult: "SUCCESS",
          scanType: "RETURN_SCAN",
        }),
        expect.any(Object)
      );
      expect(mockMarkAsClosed).toHaveBeenCalledWith("PASS2", expect.any(Object));
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          leaveRequestId: "L1",
          qrPassId: "PASS2",
          fromState: "CHECKED_OUT",
          toState: "IN_HOSTEL",
          eventType: "ENTER_HOSTEL",
          movementMethod: "QR",
          recordedBy: "U1",
          dbClient: expect.any(Object),
        })
      );
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "L1",
        expect.objectContaining({
          status: "COMPLETED",
        }),
        expect.any(Object)
      );
    });

    it("rejects a RETURN_SCAN before the pass window opens", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_RETURN_PASS,
        validFrom: new Date("2099-01-01"),
      });

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("QR pass is not valid until");
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("rejects a return-only pass while a different movement session is open", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);
      mockFindOpenSessionPass.mockResolvedValue({ id: "PASS-OTHER" });

      const result = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe(
        "Return pass does not match the open movement session"
      );
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("rejects a normal pass return when another movement session is open", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        firstScanAt: new Date(),
      });
      mockFindOpenSessionPass.mockResolvedValue({ id: "PASS-OTHER" });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe(
        "Return pass does not match the open movement session"
      );
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
    });

    it("allows a normal pass return when the open session is the same pass", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        firstScanAt: new Date(),
      });
      mockFindOpenSessionPass.mockResolvedValue({ id: "PASS1" });
      mockFindById.mockResolvedValue({
        ...VALID_PASS,
        firstScanAt: new Date(),
        qrType: "LEAVE_EXIT",
      });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(true);
      expect(mockMarkAsClosed).toHaveBeenCalledWith("PASS1", expect.any(Object));
    });

    it("rechecks return-session ownership inside the transaction", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);
      mockFindOpenSessionPass
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "PASS-OTHER" });

      await expect(
        scanQrPass({
          token: "return-token",
          scannedBy: "U1",
          scanType: "RETURN_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });
  });

  describe("transaction atomicity", () => {
    it("wraps EXIT_SCAN in db.transaction", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);

      await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(mockScanLogCreate).toHaveBeenCalledTimes(1);
      expect(mockMarkAsFirstScanned).toHaveBeenCalledTimes(1);
      expect(mockRecordMovement).toHaveBeenCalledTimes(1);
    });

    it("wraps RETURN_SCAN in db.transaction", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);

      await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(mockScanLogCreate).toHaveBeenCalledTimes(1);
      expect(mockMarkAsClosed).toHaveBeenCalledTimes(1);
      expect(mockRecordMovement).toHaveBeenCalledTimes(1);
    });

    it("propagates recordMovement failure for EXIT_SCAN", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("propagates recordMovement failure for RETURN_SCAN", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        scanQrPass({
          token: "return-token",
          scannedBy: "U1",
          scanType: "RETURN_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("concurrent scan race condition guards", () => {
    it("EXIT_SCAN on same pass twice - second call fails with already used error", async () => {
      mockFindByTokenHash
        .mockResolvedValueOnce(VALID_PASS) // First call
        .mockResolvedValueOnce({
          ...VALID_PASS,
          firstScanAt: new Date(), // Second call sees pass already used
        });

      // First EXIT_SCAN
      const first = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      // Second EXIT_SCAN (simulating double-tap / race)
      const second = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(second.failureReason).toBe("QR pass has already been used for exit");
      // Both calls create scan logs (one SUCCESS, one FAILED)
      expect(mockScanLogCreate).toHaveBeenCalledTimes(2);
    });

    it("RETURN_SCAN on same pass twice - second call fails with already used error", async () => {
      mockFindByTokenHash
        .mockResolvedValueOnce(VALID_RETURN_PASS) // First call
        .mockResolvedValueOnce({
          ...VALID_RETURN_PASS,
          closedAt: new Date(), // Second call sees pass already closed
        });

      const first = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      const second = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(second.failureReason).toBe("QR pass has already been used for return");
      expect(mockScanLogCreate).toHaveBeenCalledTimes(2);
    });

    it("EXIT_SCAN then RETURN_SCAN on same pass - both succeed as state transitions", async () => {
      mockFindByTokenHash
        .mockResolvedValueOnce(VALID_PASS) // EXIT_SCAN sees unused pass
        .mockResolvedValueOnce({
          ...VALID_RETURN_PASS,
          firstScanAt: new Date(),
          closedAt: null, // RETURN_SCAN sees exited but not returned
        });

      const exitResult = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      const returnResult = await scanQrPass({
        token: "return-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(exitResult.success).toBe(true);
      expect(returnResult.success).toBe(true);
      expect(mockMarkAsFirstScanned).toHaveBeenCalledTimes(1);
      expect(mockMarkAsClosed).toHaveBeenCalledTimes(1);
      expect(mockRecordMovement).toHaveBeenCalledTimes(2);
    });

    it("RETURN_SCAN before EXIT_SCAN on same pass - fails with not exited error", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS); // No firstScanAt

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "RETURN_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("Student has not exited yet");
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
    });

    it("EXIT_SCAN on fully used pass (firstScanAt + closedAt) - fails with exit already used error", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        firstScanAt: new Date(),
        closedAt: new Date(),
      });

      const result = await scanQrPass({
        token: "exit-token",
        scannedBy: "U1",
        scanType: "EXIT_SCAN",
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toBe("QR pass has already been used for exit");
    });

    it("EXIT_SCAN fails when a concurrent scan wins the guarded update", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_PASS);
      mockMarkAsFirstScanned.mockResolvedValue(null);

      await expect(
        scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("RETURN_SCAN fails when a concurrent return wins the guarded update", async () => {
      mockFindByTokenHash.mockResolvedValue(VALID_RETURN_PASS);
      mockMarkAsClosed.mockResolvedValue(null);

      await expect(
        scanQrPass({
          token: "return-token",
          scannedBy: "U1",
          scanType: "RETURN_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });

    it("rejects EXIT_SCAN when the token was rotated after lookup", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_PASS,
        tokenHash: "old-token-hash",
      });
      mockFindById.mockResolvedValue({
        ...VALID_PASS,
        status: "ACTIVE",
        tokenHash: "new-token-hash",
      });

      await expect(
        scanQrPass({
          token: "exit-token",
          scannedBy: "U1",
          scanType: "EXIT_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockMarkAsFirstScanned).not.toHaveBeenCalled();
    });

    it("rejects RETURN_SCAN when the token was rotated after lookup", async () => {
      mockFindByTokenHash.mockResolvedValue({
        ...VALID_RETURN_PASS,
        tokenHash: "old-token-hash",
      });
      mockFindById.mockResolvedValue({
        ...VALID_RETURN_PASS,
        status: "ACTIVE",
        tokenHash: "new-token-hash",
      });

      await expect(
        scanQrPass({
          token: "return-token",
          scannedBy: "U1",
          scanType: "RETURN_SCAN",
        })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
    });
  });
});
