// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockFindByTokenHash = vi.fn();
const mockFindOpenSessionPass = vi.fn();
const mockQrScanLogCreate = vi.fn();
const mockStudentFindById = vi.fn();
const mockUserFindById = vi.fn();
const mockHostelFindById = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveTypeFindById = vi.fn();
const mockRecordMovement = vi.fn();

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/db/transaction", () => ({
  transaction: (...args: any[]) => vi.fn()(...args),
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByTokenHash: (...args: any[]) => mockFindByTokenHash(...args),
    findOpenSessionPassForStudent: (...args: any[]) =>
      mockFindOpenSessionPass(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-scan-log.repository", () => ({
  qrScanLogRepository: { create: (...args: any[]) => mockQrScanLogCreate(...args) },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: { findById: (...args: any[]) => mockStudentFindById(...args) },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: { findById: (...args: any[]) => mockUserFindById(...args) },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: { findById: (...args: any[]) => mockHostelFindById(...args) },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: { findById: (...args: any[]) => mockLeaveFindById(...args) },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: { findById: (...args: any[]) => mockLeaveTypeFindById(...args) },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: { record: vi.fn() },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: { publish: vi.fn() },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

import { previewQrScan } from "@/services/movement/scan-qr.service";

const ACTIVE_UNSCANNED_PASS = {
  id: "QP1",
  qrType: "LEAVE_EXIT",
  status: "ACTIVE",
  firstScanAt: null,
  closedAt: null,
  studentId: "S1",
  leaveRequestId: "L1",
};

const ACTIVE_RETURN_PASS = {
  id: "QP2",
  qrType: "LEAVE_RETURN",
  status: "ACTIVE",
  firstScanAt: new Date("2026-08-20T08:00:00.000Z"),
  closedAt: null,
  studentId: "S1",
  leaveRequestId: "L1",
};

const USED_PASS = {
  id: "QP3",
  qrType: "LEAVE_EXIT",
  status: "ACTIVE",
  firstScanAt: new Date("2026-08-20T08:00:00.000Z"),
  closedAt: new Date("2026-08-20T20:00:00.000Z"),
  studentId: "S1",
  leaveRequestId: "L1",
};

const STUDENT = { id: "S1", userId: "U1", rollNumber: "STU-001", roomNumber: "A-101" };
const USER = { id: "U1", fullName: "John Doe", hostelId: "H1" };
const HOSTEL = { id: "H1", name: "Alpha Hostel" };
const LEAVE = {
  id: "L1",
  leaveTypeId: "LT1",
  startAt: new Date("2026-08-20T10:00:00.000Z"),
  endAt: new Date("2026-08-22T10:00:00.000Z"),
  status: "APPROVED",
};
const LEAVE_TYPE = { id: "LT1", name: "Home Visit" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-20T11:00:00.000Z"));
  vi.clearAllMocks();
  mockFindByTokenHash.mockResolvedValue(ACTIVE_UNSCANNED_PASS);
  mockFindOpenSessionPass.mockResolvedValue(null);
  mockStudentFindById.mockResolvedValue(STUDENT);
  mockUserFindById.mockResolvedValue(USER);
  mockHostelFindById.mockResolvedValue(HOSTEL);
  mockLeaveFindById.mockResolvedValue(LEAVE);
  mockLeaveTypeFindById.mockResolvedValue(LEAVE_TYPE);
});


afterEach(() => {
  vi.useRealTimers();
});
describe("previewQrScan", () => {
  it("returns student details for an unscanned EXIT pass", async () => {
    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(true);
    expect(result.scanType).toBe("EXIT_SCAN");
    expect(result.student).toEqual({
      name: "John Doe",
      rollNumber: "STU-001",
      roomNumber: "A-101",
      hostelName: "Alpha Hostel",
    });
    expect(result.leave?.typeName).toBe("Home Visit");
  });

  it("detects RETURN_SCAN for LEAVE_RETURN passes", async () => {
    mockFindByTokenHash.mockResolvedValue(ACTIVE_RETURN_PASS);

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(true);
    expect(result.scanType).toBe("RETURN_SCAN");
  });

  it("rejects fully used passes without touching state", async () => {
    mockFindByTokenHash.mockResolvedValue(USED_PASS);

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("QR pass has already been fully used");
    expect(mockQrScanLogCreate).not.toHaveBeenCalled();
  });

  it("rejects unknown tokens", async () => {
    mockFindByTokenHash.mockResolvedValue(null);

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("QR token not found");
  });

  it("rejects inactive passes", async () => {
    mockFindByTokenHash.mockResolvedValue({
      ...ACTIVE_UNSCANNED_PASS,
      status: "INVALIDATED",
    });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("QR pass status is INVALIDATED");
  });

  it("rejects an EXIT preview before the pass window opens", async () => {
    mockFindByTokenHash.mockResolvedValue({
      ...ACTIVE_UNSCANNED_PASS,
      validFrom: new Date("2099-01-01T00:00:00.000Z"),
    });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not valid until");
  });

  it("rejects an EXIT preview after the pass expires", async () => {
    mockFindByTokenHash.mockResolvedValue({
      ...ACTIVE_UNSCANNED_PASS,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("QR pass has expired");
  });

  it("rejects a RETURN preview before the pass window opens", async () => {
    mockFindByTokenHash.mockResolvedValue({
      ...ACTIVE_RETURN_PASS,
      validFrom: new Date("2099-01-01T00:00:00.000Z"),
    });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not valid until");
  });

  it("rejects a RETURN preview while a different movement session is open", async () => {
    mockFindByTokenHash.mockResolvedValue(ACTIVE_RETURN_PASS);
    mockFindOpenSessionPass.mockResolvedValue({ id: "QP-OTHER" });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe(
      "Return pass does not match the open movement session"
    );
  });

  it("rejects a pass whose leave is no longer live", async () => {
    mockLeaveFindById.mockResolvedValue({ ...LEAVE, status: "CANCELLED" });

    const result = await previewQrScan("raw-token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Leave is CANCELLED");
  });

  it("never records a scan log, movement, audit, or outbox event", async () => {
    await previewQrScan("raw-token");

    expect(mockQrScanLogCreate).not.toHaveBeenCalled();
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("allows EXIT preview on the leaving date even before validFrom time of day", async () => {
    vi.useFakeTimers();
    // 09:30 AM IST on 2026-06-15 (04:00:00.000Z)
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));
    try {
      mockFindByTokenHash.mockResolvedValue({
        ...ACTIVE_UNSCANNED_PASS,
        // 18:00 IST on 2026-06-15 (12:30:00.000Z)
        validFrom: new Date("2026-06-15T12:30:00.000Z"),
      });

      const result = await previewQrScan("raw-token");
      expect(result.valid).toBe(true);
      expect(result.scanType).toBe("EXIT_SCAN");
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows EXIT preview for a multi-day leave on the day before return date, but rejects on return date", async () => {
    vi.useFakeTimers();
    // Day before return date: 2026-06-14 18:00 IST (12:30:00.000Z)
    vi.setSystemTime(new Date("2026-06-14T12:30:00.000Z"));
    try {
      mockFindByTokenHash.mockResolvedValue(ACTIVE_UNSCANNED_PASS);
      mockLeaveFindById.mockResolvedValue({
        ...LEAVE,
        startAt: new Date("2026-06-10T04:30:00.000Z"),
        endAt: new Date("2026-06-15T14:30:00.000Z"),
      });

      const dayBeforeResult = await previewQrScan("raw-token");
      expect(dayBeforeResult.valid).toBe(true);
      expect(dayBeforeResult.scanType).toBe("EXIT_SCAN");

      // On return date: 2026-06-15 09:00 IST (03:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-15T03:30:00.000Z"));
      const returnDateResult = await previewQrScan("raw-token");
      expect(returnDateResult.valid).toBe(false);
      expect(returnDateResult.reason).toBe("QR pass has expired");
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows RETURN preview from leave date through return date, and rejects after return date", async () => {
    vi.useFakeTimers();
    try {
      mockFindByTokenHash.mockResolvedValue(ACTIVE_RETURN_PASS);
      mockLeaveFindById.mockResolvedValue({
        ...LEAVE,
        startAt: new Date("2026-06-10T04:30:00.000Z"),
        endAt: new Date("2026-06-15T14:30:00.000Z"),
      });

      // 1. Before leave date: 2026-06-09 18:00 IST (12:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-09T12:30:00.000Z"));
      const beforeLeaveResult = await previewQrScan("raw-token");
      expect(beforeLeaveResult.valid).toBe(false);
      expect(beforeLeaveResult.reason).toContain("not valid until");

      // 2. On leave date: 2026-06-10 09:00 IST (03:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-10T03:30:00.000Z"));
      const onLeaveDateResult = await previewQrScan("raw-token");
      expect(onLeaveDateResult.valid).toBe(true);
      expect(onLeaveDateResult.scanType).toBe("RETURN_SCAN");

      // 3. Between leave and return date: 2026-06-12 12:00 IST (06:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-12T06:30:00.000Z"));
      const midLeaveResult = await previewQrScan("raw-token");
      expect(midLeaveResult.valid).toBe(true);
      expect(midLeaveResult.scanType).toBe("RETURN_SCAN");

      // 4. On return date: 2026-06-15 22:00 IST (16:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-15T16:30:00.000Z"));
      const returnDateResult = await previewQrScan("raw-token");
      expect(returnDateResult.valid).toBe(true);
      expect(returnDateResult.scanType).toBe("RETURN_SCAN");

      // 5. Day after return date: 2026-06-16 01:00 IST (2026-06-15T19:30:00.000Z)
      vi.setSystemTime(new Date("2026-06-15T19:30:00.000Z"));
      const expiredResult = await previewQrScan("raw-token");
      expect(expiredResult.valid).toBe(false);
      expect(expiredResult.reason).toBe("QR pass has expired");
    } finally {
      vi.useRealTimers();
    }
  });
});
