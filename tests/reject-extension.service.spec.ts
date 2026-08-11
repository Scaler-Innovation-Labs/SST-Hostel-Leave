// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockFindPending = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();
const mockLeaveFindById = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
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
}));

vi.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: { transaction: (cb: any) => cb(tx) },
  };
});

import { rejectExtension } from "@/services/leave/reject-extension.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockOutboxPublish.mockResolvedValue(undefined);
  mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "REJECTED" });
  mockUpdateById.mockResolvedValue({ id: "EXT1", status: "REJECTED" });
  mockFindById.mockResolvedValue({ id: "EXT1", status: "PENDING", leaveRequestId: "LR1" });
  mockFindByIdForUpdate.mockResolvedValue({ id: "EXT1", status: "PENDING", leaveRequestId: "LR1" });
  mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
  mockLeaveFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });
});

describe("rejectExtension service", () => {
  it("rejects a PENDING extension", async () => {
    const result = await rejectExtension("EXT1", { decision: "REJECTED", comments: "Not allowed" }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({
      extensionId: "EXT1",
      leaveRequestId: "LR1",
      decision: "REJECTED",
      stepKey: null,
      stepOrder: null,
      newStatus: "REJECTED",
    });
    expect(mockUpdateById).toHaveBeenCalledWith("EXT1", expect.objectContaining({ status: "REJECTED" }), expect.any(Object));
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_EXTENSION_REJECTED" }),
      expect.any(Object)
    );
  });

  it("throws NotFoundError when extension does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(rejectExtension("NONEXISTENT", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when extension is not PENDING", async () => {
    mockFindById.mockResolvedValue({ id: "EXT2", status: "APPROVED" });

    await expect(rejectExtension("EXT2", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when no pending approval found", async () => {
    mockFindPending.mockResolvedValue([]);

    await expect(rejectExtension("EXT1", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("records audit on reject", async () => {
    await rejectExtension("EXT1", { decision: "REJECTED" }, { id: "U1", roles: ["ADMIN"] });

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "LEAVE_EXTENSION",
      "EXT1",
      "U1",
      expect.objectContaining({ oldStatus: "PENDING", newStatus: "REJECTED" }),
      expect.any(Object)
    );
  });
});
