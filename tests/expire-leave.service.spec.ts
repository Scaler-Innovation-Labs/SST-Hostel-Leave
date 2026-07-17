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

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();
const mockRecordMovement = vi.fn();
const mockFindExpiredLeaves = vi.fn();
const mockFindStudentById = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    findExpiredLeaves: (...args: any[]) => mockFindExpiredLeaves(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { expireSingleLeave, expireOverdueLeaves } from "@/services/leave/expire-leave.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "APPROVED_LEAVE" });
});

describe("expireSingleLeave service", () => {
  it("expires an APPROVED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L1", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockUpdateById.mockResolvedValue({ id: "L1", status: "EXPIRED" });

    const result = await expireSingleLeave("L1", { id: "SYSTEM" });

    expect(result).toEqual({
      leaveId: "L1",
      newStatus: "EXPIRED",
      expiredAt: expect.any(Date),
    });
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "EXPIRED", expiredAt: expect.any(Date) }),
      expect.any(Object)
    );
  });

  it("records movement when student is outside hostel", async () => {
    mockFindById.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "CHECKED_OUT" });
    mockUpdateById.mockResolvedValue({ id: "L2", status: "EXPIRED" });

    await expireSingleLeave("L2", { id: "SYSTEM" });

    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("does not record movement when student is IN_HOSTEL", async () => {
    mockFindById.mockResolvedValue({ id: "L3", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L3", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });
    mockUpdateById.mockResolvedValue({ id: "L3", status: "EXPIRED" });

    await expireSingleLeave("L3", { id: "SYSTEM" });

    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("cannot expire PENDING leave", async () => {
    mockFindById.mockResolvedValue({ id: "L4", status: "PENDING" });

    await expect(
      expireSingleLeave("L4", { id: "SYSTEM" })
    ).rejects.toThrow("Cannot expire leave in PENDING status");
  });

  it("records audit on expire", async () => {
    mockFindById.mockResolvedValue({ id: "L5", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L5", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") });
    mockUpdateById.mockResolvedValue({ id: "L5", status: "EXPIRED" });

    await expireSingleLeave("L5", { id: "SYSTEM" });

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "LEAVE_REQUEST",
      "L5",
      "SYSTEM",
      expect.objectContaining({
        oldStatus: "APPROVED",
        newStatus: "EXPIRED",
      }),
      expect.any(Object)
    );
  });
});

describe("expireOverdueLeaves service", () => {
  it("expires all overdue leaves in batch", async () => {
    mockFindExpiredLeaves.mockResolvedValue([
      { id: "L1", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") },
      { id: "L2", status: "APPROVED", studentId: "S2", endAt: new Date("2026-06-02") },
    ]);
    mockFindByIdForUpdate.mockImplementation((_id) =>
      Promise.resolve({ id: _id, status: "APPROVED", studentId: "S1" })
    );
    mockFindById.mockImplementation((_id) =>
      Promise.resolve({ id: _id, status: "APPROVED", studentId: "S1" })
    );
    mockUpdateById.mockResolvedValue({ status: "EXPIRED" });

    const result = await expireOverdueLeaves({ id: "SYSTEM" });

    expect(result.total).toBe(2);
    expect(result.expired).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("handles errors in batch gracefully", async () => {
    mockFindExpiredLeaves.mockResolvedValue([
      { id: "L1", status: "APPROVED", studentId: "S1", endAt: new Date("2026-06-01") },
      { id: "L2", status: "PENDING", studentId: "S2", endAt: new Date("2026-06-02") },
    ]);
    mockFindById.mockImplementation((_id) =>
      Promise.resolve({ id: _id, status: "PENDING", studentId: "S1" })
    );

    const result = await expireOverdueLeaves({ id: "SYSTEM" });

    expect(result.total).toBe(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns empty result when no overdue leaves", async () => {
    mockFindExpiredLeaves.mockResolvedValue([]);

    const result = await expireOverdueLeaves({ id: "SYSTEM" });

    expect(result).toEqual({
      total: 0,
      expired: 0,
      skipped: 0,
      errors: [],
    });
  });
});
