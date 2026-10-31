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
const mockLeaveFindByIdForUpdate = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
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
  requireRejectionAuthorization: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: { transaction: (cb: any) => cb(tx) },
  };
});

import { rejectExtension } from "@/services/leave/reject-extension.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

const currentUser = { id: "U1", roles: ["ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockOutboxPublish.mockResolvedValue(undefined);
  mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "REJECTED" });
});

describe("rejectExtension service", () => {
  it("rejects a PENDING extension successfully", async () => {
    mockFindById.mockResolvedValue({ id: "E1", status: "PENDING", leaveRequestId: "L1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "E1", status: "PENDING", leaveRequestId: "L1", currentStepKey: "S1", currentStepOrder: 1 });
    mockLeaveFindById.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockLeaveFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", assignedApproverUserId: null, approverRoleCode: null }]);
    mockUpdateById.mockResolvedValue({ id: "E1", status: "REJECTED" });

    const result = await rejectExtension("E1", { decision: "REJECTED", comments: "No extensions allowed" }, currentUser);

    expect(result).toEqual({
      extensionId: "E1",
      leaveRequestId: "L1",
      decision: "REJECTED",
      stepKey: null,
      stepOrder: null,
      newStatus: "REJECTED",
    });
    expect(mockUpdateDecisionById).toHaveBeenCalledWith(
      "A1",
      "REJECTED",
      "U1",
      "No extensions allowed",
      expect.any(Date),
      expect.any(Object),
      undefined,
      undefined
    );
    expect(mockUpdateById).toHaveBeenCalledWith(
      "E1",
      expect.objectContaining({ status: "REJECTED", rejectedAt: expect.any(Date), currentStepKey: null, currentStepOrder: null }),
      expect.any(Object)
    );
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEAVE_EXTENSION_REJECTED",
        payload: expect.objectContaining({ extensionId: "E1", comments: "No extensions allowed" }),
      }),
      expect.any(Object)
    );
  });

  it("throws NotFoundError when extension does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      rejectExtension("NONEXISTENT", { decision: "REJECTED" }, currentUser)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when extension is not in PENDING status", async () => {
    mockFindById.mockResolvedValue({ id: "E2", status: "APPROVED", leaveRequestId: "L1" });

    await expect(
      rejectExtension("E2", { decision: "REJECTED" }, currentUser)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when parent leave is not in APPROVED or OVERDUE status", async () => {
    mockFindById.mockResolvedValue({ id: "E3", status: "PENDING", leaveRequestId: "L1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "E3", status: "PENDING", leaveRequestId: "L1" });
    mockLeaveFindById.mockResolvedValue({ id: "L1", status: "PENDING" });
    mockLeaveFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "PENDING" });

    await expect(
      rejectExtension("E3", { decision: "REJECTED" }, currentUser)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when no pending approval exists for extension", async () => {
    mockFindById.mockResolvedValue({ id: "E4", status: "PENDING", leaveRequestId: "L1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "E4", status: "PENDING", leaveRequestId: "L1" });
    mockLeaveFindById.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockLeaveFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockFindPending.mockResolvedValue([]);

    await expect(
      rejectExtension("E4", { decision: "REJECTED" }, currentUser)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("records audit log on rejection", async () => {
    mockFindById.mockResolvedValue({ id: "E5", status: "PENDING", leaveRequestId: "L1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "E5", status: "PENDING", leaveRequestId: "L1", currentStepKey: "S1", currentStepOrder: 1 });
    mockLeaveFindById.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockLeaveFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "APPROVED" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", assignedApproverUserId: null, approverRoleCode: null }]);
    mockUpdateById.mockResolvedValue({ id: "E5", status: "REJECTED" });

    await rejectExtension("E5", { decision: "REJECTED" }, currentUser);

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "LEAVE_EXTENSION",
      "E5",
      "U1",
      expect.objectContaining({ oldStatus: "PENDING", newStatus: "REJECTED" }),
      expect.any(Object)
    );
  });
});
