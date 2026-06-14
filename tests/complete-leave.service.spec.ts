// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
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

import { completeLeave } from "@/services/leave/complete-leave.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
});

describe("completeLeave service", () => {
  it("completes an APPROVED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L1", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "APPROVED", studentId: "S1" });
    mockUpdateById.mockResolvedValue({ id: "L1", status: "COMPLETED" });

    const result = await completeLeave("L1", {}, { id: "U1" });

    expect(result).toEqual({
      leaveId: "L1",
      newStatus: "COMPLETED",
      completedAt: expect.any(Date),
    });
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({
        status: "COMPLETED",
        completedAt: expect.any(Date),
        actualReturnAt: expect.any(Date),
      }),
      expect.any(Object)
    );
  });

  it("completes with custom actualReturnAt", async () => {
    const returnAt = "2026-06-10T14:00:00Z";
    mockFindById.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1" });
    mockUpdateById.mockResolvedValue({ id: "L2", status: "COMPLETED" });

    const result = await completeLeave("L2", { actualReturnAt: returnAt }, { id: "U1" });

    expect(result).toEqual({
      leaveId: "L2",
      newStatus: "COMPLETED",
      completedAt: expect.any(Date),
    });
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L2",
      expect.objectContaining({
        actualReturnAt: new Date(returnAt),
      }),
      expect.any(Object)
    );
  });

  it("cannot complete PENDING leave", async () => {
    mockFindById.mockResolvedValue({ id: "L3", status: "PENDING" });

    await expect(
      completeLeave("L3", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot complete REJECTED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L4", status: "REJECTED" });

    await expect(
      completeLeave("L4", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot complete CANCELLED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L5", status: "CANCELLED" });

    await expect(
      completeLeave("L5", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot complete COMPLETED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L6", status: "COMPLETED" });

    await expect(
      completeLeave("L6", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      completeLeave("NONEXISTENT", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("records audit on complete", async () => {
    mockFindById.mockResolvedValue({ id: "L7", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L7", status: "APPROVED", studentId: "S1" });
    mockUpdateById.mockResolvedValue({ id: "L7", status: "COMPLETED" });

    await completeLeave("L7", {}, { id: "U1" });

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "LEAVE_REQUEST",
      "L7",
      "U1",
      expect.objectContaining({
        oldStatus: "APPROVED",
        newStatus: "COMPLETED",
      }),
      expect.any(Object)
    );
  });
});
