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
const mockFindPending = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByEntityAndDecision: (...args: any[]) => mockFindPending(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
    findNextByEntityAndDecision: vi.fn(),
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
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApprovalAuthorization: vi.fn(),
  requireAnyRole: vi.fn(),
}));

import { rejectLeave } from "@/services/leave/reject-leave.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockOutboxPublish.mockResolvedValue(undefined);
  mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "REJECTED" });
});

describe("rejectLeave service", () => {
  it("rejects a PENDING leave", async () => {
    mockFindById.mockResolvedValue({ id: "L1", status: "PENDING", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "PENDING", studentId: "S1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateById.mockResolvedValue({ id: "L1", status: "REJECTED" });

    const result = await rejectLeave("L1", { decision: "REJECTED", comments: "Not approved" }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({
      leaveId: "L1",
      decision: "REJECTED",
      stepKey: null,
      stepOrder: null,
      newStatus: "REJECTED",
    });
    expect(mockUpdateDecisionById).toHaveBeenCalledWith("A1", "REJECTED", "U1", "Not approved", expect.any(Date), expect.any(Object), undefined, undefined);
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "REJECTED", rejectedAt: expect.any(Date), currentStepKey: null, currentStepOrder: null }),
      expect.any(Object)
    );
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_REJECTED" }),
      expect.any(Object)
    );
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      rejectLeave("NONEXISTENT", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when leave is not PENDING", async () => {
    mockFindById.mockResolvedValue({ id: "L2", status: "APPROVED" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L2", status: "APPROVED" });

    await expect(
      rejectLeave("L2", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when leave is already CANCELLED", async () => {
    mockFindById.mockResolvedValue({ id: "L3", status: "CANCELLED" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L3", status: "CANCELLED" });

    await expect(
      rejectLeave("L3", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when leave is already COMPLETED", async () => {
    mockFindById.mockResolvedValue({ id: "L4", status: "COMPLETED" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L4", status: "COMPLETED" });

    await expect(
      rejectLeave("L4", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when no pending approval found", async () => {
    mockFindById.mockResolvedValue({ id: "L5", status: "PENDING", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L5", status: "PENDING", studentId: "S1" });
    mockFindPending.mockResolvedValue([]);

    await expect(
      rejectLeave("L5", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("records audit on reject", async () => {
    mockFindById.mockResolvedValue({ id: "L6", status: "PENDING", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L6", status: "PENDING", studentId: "S1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateById.mockResolvedValue({ id: "L6", status: "REJECTED" });

    await rejectLeave("L6", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] });

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "LEAVE_REQUEST",
      "L6",
      "U1",
      expect.objectContaining({
        oldStatus: "PENDING",
        newStatus: "REJECTED",
      }),
      expect.any(Object)
    );
  });
});
