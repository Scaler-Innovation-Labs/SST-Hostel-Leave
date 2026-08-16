// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockFindOverdueLeaves = vi.fn();
const mockFindStudentById = vi.fn();
const mockFindOpenSessionPass = vi.fn();
const mockRecordMovement = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    findOverdueLeaves: (...args: any[]) => mockFindOverdueLeaves(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findOpenSessionPassForStudent: (...args: any[]) => mockFindOpenSessionPass(...args),
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
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  markOverdueSingleLeave,
  markOverdueLeaves,
} from "@/services/leave/mark-overdue-leave.service";
import { ConflictError } from "@/lib/errors";

const APPROVED_LEAVE = {
  id: "L1",
  studentId: "S1",
  status: "APPROVED",
  endAt: new Date("2026-06-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockUpdateById.mockResolvedValue({ id: "L1", status: "OVERDUE" });
  mockFindOpenSessionPass.mockResolvedValue({ id: "QP1" });
});

describe("markOverdueSingleLeave service", () => {
  it("marks the leave OVERDUE and records movement atomically (T7)", async () => {
    mockFindById.mockResolvedValue(APPROVED_LEAVE);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockFindStudentById.mockResolvedValue({
      id: "S1",
      currentLocationState: "OUTSIDE_HOSTEL",
    });

    const result = await markOverdueSingleLeave("L1", { id: "SYSTEM" });

    expect(result.newStatus).toBe("OVERDUE");
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "OVERDUE" }),
      expect.any(Object)
    );
    expect(mockRecordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "S1",
        leaveRequestId: "L1",
        qrPassId: "QP1",
        fromState: "OUTSIDE_HOSTEL",
        toState: "OVERDUE",
        eventType: "AUTO_OVERDUE",
        dbClient: expect.any(Object),
      })
    );
  });

  it("records movement from legacy CHECKED_OUT state too", async () => {
    mockFindById.mockResolvedValue(APPROVED_LEAVE);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockFindStudentById.mockResolvedValue({
      id: "S1",
      currentLocationState: "CHECKED_OUT",
    });

    await markOverdueSingleLeave("L1", { id: "SYSTEM" });

    expect(mockRecordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        fromState: "CHECKED_OUT",
        toState: "OVERDUE",
      })
    );
  });

  it("does not record movement when the student is already IN_HOSTEL", async () => {
    mockFindById.mockResolvedValue(APPROVED_LEAVE);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockFindStudentById.mockResolvedValue({
      id: "S1",
      currentLocationState: "IN_HOSTEL",
    });

    await markOverdueSingleLeave("L1", { id: "SYSTEM" });

    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("rejects a PENDING leave", async () => {
    mockFindById.mockResolvedValue({ id: "L2", status: "PENDING" });

    await expect(
      markOverdueSingleLeave("L2", { id: "SYSTEM" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("publishes LEAVE_OVERDUE outbox event", async () => {
    mockFindById.mockResolvedValue(APPROVED_LEAVE);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockFindStudentById.mockResolvedValue({
      id: "S1",
      currentLocationState: "OUTSIDE_HOSTEL",
    });

    const { outboxService } = await import("@/services/outbox/outbox.service");

    await markOverdueSingleLeave("L1", { id: "SYSTEM" });

    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_OVERDUE" }),
      expect.any(Object)
    );
  });
});

describe("markOverdueLeaves service", () => {
  it("marks all due leaves overdue in batch", async () => {
    mockFindOverdueLeaves.mockResolvedValue([
      APPROVED_LEAVE,
      { ...APPROVED_LEAVE, id: "L2", studentId: "S2" },
    ]);
    mockFindById.mockImplementation((id: string) =>
      Promise.resolve({ ...APPROVED_LEAVE, id, studentId: id === "L2" ? "S2" : "S1" })
    );
    mockFindByIdForUpdate.mockImplementation((id: string) =>
      Promise.resolve({ ...APPROVED_LEAVE, id, studentId: id === "L2" ? "S2" : "S1" })
    );
    mockFindStudentById.mockResolvedValue({
      id: "S1",
      currentLocationState: "OUTSIDE_HOSTEL",
    });

    const result = await markOverdueLeaves({ id: "SYSTEM" });

    expect(result.total).toBe(2);
    expect(result.overdue).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("returns empty result when nothing is due", async () => {
    mockFindOverdueLeaves.mockResolvedValue([]);

    const result = await markOverdueLeaves({ id: "SYSTEM" });

    expect(result).toEqual({
      total: 0,
      overdue: 0,
      skipped: 0,
      errors: [],
    });
  });
});
