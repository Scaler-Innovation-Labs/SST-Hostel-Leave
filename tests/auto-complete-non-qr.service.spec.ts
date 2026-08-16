// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindAutoCompleteDue = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockFindExtensions = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    findAutoCompleteDueNonQrLeaves: (...args: any[]) => mockFindAutoCompleteDue(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindExtensions(...args),
  },
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

import { autoCompleteNonQrLeaves } from "@/services/leave/auto-complete-non-qr.service";

const APPROVED_LEAVE = {
  id: "L1",
  studentId: "S1",
  status: "APPROVED",
  endAt: new Date("2026-06-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockFindExtensions.mockResolvedValue([]);
});

describe("autoCompleteNonQrLeaves service", () => {
  it("completes due non-QR leaves (T16)", async () => {
    mockFindAutoCompleteDue.mockResolvedValue([APPROVED_LEAVE]);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockUpdateById.mockResolvedValue({ id: "L1", status: "COMPLETED" });

    const result = await autoCompleteNonQrLeaves({ id: "SYSTEM" });

    expect(result).toEqual({
      total: 1,
      completed: 1,
      skipped: 0,
      errors: [],
    });
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
      expect.any(Object)
    );
  });

  it("skips a leave with a PENDING extension", async () => {
    mockFindAutoCompleteDue.mockResolvedValue([APPROVED_LEAVE]);
    mockFindByIdForUpdate.mockResolvedValue(APPROVED_LEAVE);
    mockFindExtensions.mockResolvedValue([
      { id: "EXT1", leaveRequestId: "L1", status: "PENDING" },
    ]);

    const result = await autoCompleteNonQrLeaves({ id: "SYSTEM" });

    expect(result.completed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockUpdateById).not.toHaveBeenCalled();
  });

  it("skips when the leave is no longer APPROVED inside the transaction", async () => {
    mockFindAutoCompleteDue.mockResolvedValue([APPROVED_LEAVE]);
    mockFindByIdForUpdate.mockResolvedValue({ ...APPROVED_LEAVE, status: "COMPLETED" });

    const result = await autoCompleteNonQrLeaves({ id: "SYSTEM" });

    expect(result.completed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("returns empty result when nothing is due", async () => {
    mockFindAutoCompleteDue.mockResolvedValue([]);

    const result = await autoCompleteNonQrLeaves({ id: "SYSTEM" });

    expect(result).toEqual({
      total: 0,
      completed: 0,
      skipped: 0,
      errors: [],
    });
  });
});
