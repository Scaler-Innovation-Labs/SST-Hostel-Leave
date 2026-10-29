// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const mockResetFirstScan = vi.fn();
const mockInvalidate = vi.fn();
const mockScanLogCreate = vi.fn();
const mockCountTodaySuccessfulScans = vi.fn();
const mockRecordMovement = vi.fn();
const mockStudentFindById = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockOutboxPublish = vi.fn().mockResolvedValue({});
const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveUpdateById = vi.fn().mockResolvedValue({});
const mockLeaveTypeFindById = vi.fn();
const mockUserFindById = vi.fn();
const mockHostelFindById = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByTokenHash: (...args: any[]) => mockFindByTokenHash(...args),
    findById: (...args: any[]) => mockFindById(...args),
    findUsableExitPassForStudent: (...args: any[]) => mockFindUsableExitPass(...args),
    findOpenSessionPassForStudent: (...args: any[]) => mockFindOpenSessionPass(...args),
    markAsFirstScanned: (...args: any[]) => mockMarkAsFirstScanned(...args),
    markAsClosed: (...args: any[]) => mockMarkAsClosed(...args),
    resetFirstScan: (...args: any[]) => mockResetFirstScan(...args),
    invalidate: (...args: any[]) => mockInvalidate(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-scan-log.repository", () => ({
  qrScanLogRepository: {
    create: (...args: any[]) => mockScanLogCreate(...args),
    countTodaySuccessfulScans: (...args: any[]) => mockCountTodaySuccessfulScans(...args),
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

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockUserFindById(...args),
  },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockHostelFindById(...args),
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

import { previewQrScan, scanQrPass } from "@/services/movement/scan-qr.service";

describe("Daily Recurring QR Pass (Late Stay At College - up to 2 return scans per day)", () => {
  const basePass = {
    id: "QP1",
    studentId: "S1",
    leaveRequestId: "LR1",
    tokenHash: "hashed",
    qrType: "LEAVE_RETURN",
    status: "ACTIVE",
    validFrom: new Date(Date.now() - 3600000), // 1 hr ago
    expiresAt: new Date(Date.now() + 5 * 86400000), // 5 days later
    firstScanAt: null,
    closedAt: null,
  };

  const baseLeave = {
    id: "LR1",
    studentId: "S1",
    leaveTypeId: "LT_LATE_STAY",
    status: "APPROVED",
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 5 * 86400000), // 5 days later
  };

  const lateStayLeaveType = {
    id: "LT_LATE_STAY",
    code: "LATE_STAY_COLLEGE",
    qrMode: "DAILY_RECURRING",
    name: "Late Stay At College",
  };

  const studentInHostel = {
    id: "S1",
    userId: "U1",
    currentLocationState: "IN_HOSTEL",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByTokenHash.mockResolvedValue(basePass);
    mockFindById.mockResolvedValue(basePass);
    mockLeaveFindById.mockResolvedValue(baseLeave);
    mockLeaveFindByIdForUpdate.mockResolvedValue(baseLeave);
    mockLeaveTypeFindById.mockResolvedValue(lateStayLeaveType);
    mockStudentFindById.mockResolvedValue(studentInHostel);
    mockFindUsableExitPass.mockResolvedValue(null);
    mockFindOpenSessionPass.mockResolvedValue(null);
    mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 0, totalCount: 0 });
    mockScanLogCreate.mockResolvedValue({ id: "LOG1" });
    mockMarkAsFirstScanned.mockResolvedValue({ ...basePass, firstScanAt: new Date() });
    mockResetFirstScan.mockResolvedValue({ ...basePass, firstScanAt: null });
    mockMarkAsClosed.mockResolvedValue({ ...basePass, closedAt: new Date(), status: "USED" });
    mockRecordMovement.mockResolvedValue({ id: "ME1" });
  });

  describe("previewQrScan for DAILY_RECURRING leave", () => {
    it("always previews RETURN_SCAN for recurring passes within limit", async () => {
      const res = await previewQrScan("raw-token");
      expect(res.valid).toBe(true);
      expect(res.scanType).toBe("RETURN_SCAN");
    });

    it("rejects preview when daily return scan limit (2 return scans) is reached", async () => {
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 2, totalCount: 2 });
      const res = await previewQrScan("raw-token");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Daily return scan limit reached for today (max 2 return scans per day)");
    });
  });

  describe("scanQrPass for DAILY_RECURRING leave", () => {
    it("accepts 1st RETURN_SCAN on intermediate day, keeping pass ACTIVE and leave APPROVED", async () => {
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 0, totalCount: 0 });

      const returnRes = await scanQrPass({
        token: "raw-token",
        scannedBy: "GUARD1",
      });

      expect(returnRes.success).toBe(true);
      expect(returnRes.scanType).toBe("RETURN_SCAN");
      expect(mockResetFirstScan).toHaveBeenCalledWith("QP1", expect.anything());
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ENTER_HOSTEL",
          toState: "IN_HOSTEL",
        })
      );
    });

    it("accepts 2nd RETURN_SCAN on the same day, keeping pass ACTIVE and leave APPROVED on intermediate day", async () => {
      // 1 previous return scan completed earlier today
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 1, totalCount: 1 });

      const returnRes = await scanQrPass({
        token: "raw-token",
        scannedBy: "GUARD1",
        scanType: "RETURN_SCAN",
      });

      expect(returnRes.success).toBe(true);
      expect(returnRes.scanType).toBe("RETURN_SCAN");
      expect(mockResetFirstScan).toHaveBeenCalledWith("QP1", expect.anything());
      expect(mockMarkAsClosed).not.toHaveBeenCalled();
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
    });

    it("blocks a 3rd RETURN_SCAN on the same day when max 2 scans reached", async () => {
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 2, totalCount: 2 });

      const res = await scanQrPass({
        token: "raw-token",
        scannedBy: "GUARD1",
      });

      expect(res.success).toBe(false);
      expect(res.failureReason).toContain("Daily return scan limit reached for today (max 2 return scans per day)");
    });

    it("completes leave and closes pass on the final return scan (when now >= leave.endAt)", async () => {
      // Leave ended 10 minutes ago today
      const endingTodayLeave = {
        ...baseLeave,
        endAt: new Date(Date.now() - 600000),
      };
      mockLeaveFindById.mockResolvedValue(endingTodayLeave);
      mockLeaveFindByIdForUpdate.mockResolvedValue(endingTodayLeave);
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 0, totalCount: 0 });

      const res = await scanQrPass({
        token: "raw-token",
        scannedBy: "GUARD1",
      });

      expect(res.success).toBe(true);
      expect(mockMarkAsClosed).toHaveBeenCalledWith("QP1", expect.anything());
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR1",
        expect.objectContaining({ status: "COMPLETED" }),
        expect.anything()
      );
    });

    it("completes leave and closes pass on the 2nd return scan of the final day", async () => {
      // Final day of leave (earlier than end of day IST today)
      const endingTodayLeave = {
        ...baseLeave,
        endAt: new Date(Date.now() + 60000), // 1 minute from now
      };
      mockLeaveFindById.mockResolvedValue(endingTodayLeave);
      mockLeaveFindByIdForUpdate.mockResolvedValue(endingTodayLeave);
      mockCountTodaySuccessfulScans.mockResolvedValue({ exitCount: 0, returnCount: 1, totalCount: 1 });

      const res = await scanQrPass({
        token: "raw-token",
        scannedBy: "GUARD1",
      });

      expect(res.success).toBe(true);
      expect(mockMarkAsClosed).toHaveBeenCalledWith("QP1", expect.anything());
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR1",
        expect.objectContaining({ status: "COMPLETED" }),
        expect.anything()
      );
    });
  });
});
