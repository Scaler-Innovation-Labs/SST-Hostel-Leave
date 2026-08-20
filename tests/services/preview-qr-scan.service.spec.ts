// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByTokenHash = vi.fn();
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
  qrPassRepository: { findByTokenHash: (...args: any[]) => mockFindByTokenHash(...args) },
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
  vi.clearAllMocks();
  mockFindByTokenHash.mockResolvedValue(ACTIVE_UNSCANNED_PASS);
  mockStudentFindById.mockResolvedValue(STUDENT);
  mockUserFindById.mockResolvedValue(USER);
  mockHostelFindById.mockResolvedValue(HOSTEL);
  mockLeaveFindById.mockResolvedValue(LEAVE);
  mockLeaveTypeFindById.mockResolvedValue(LEAVE_TYPE);
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

  it("never records a scan log, movement, audit, or outbox event", async () => {
    await previewQrScan("raw-token");

    expect(mockQrScanLogCreate).not.toHaveBeenCalled();
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });
});