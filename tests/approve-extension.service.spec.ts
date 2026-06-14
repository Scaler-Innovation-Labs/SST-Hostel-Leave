// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

const mockExtensionFindById = vi.fn();
const mockExtensionFindByIdForUpdate = vi.fn();
const mockExtensionUpdateById = vi.fn();
const mockExtensionUpdateCurrentStep = vi.fn();
const mockFindPending = vi.fn();
const mockFindNextByDecisionForExtension = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockApprovalCreateMany = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findById: (...args: any[]) => mockExtensionFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockExtensionFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockExtensionUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockExtensionUpdateCurrentStep(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByLeaveExtensionAndDecision: (...args: any[]) => mockFindPending(...args),
    findNextByDecisionForExtension: (...args: any[]) => mockFindNextByDecisionForExtension(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApprovalAuthorization: vi.fn(),
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { approveExtension } from "@/services/leave/approve-extension.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
});

describe("approveExtension service", () => {
  it("approves first step and activates next step", async () => {
    mockExtensionFindById.mockResolvedValue({ id: "EXT1", status: "PENDING", leaveRequestId: "L1" });
    mockExtensionFindByIdForUpdate.mockResolvedValue({ id: "EXT1", status: "PENDING", leaveRequestId: "L1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverRoleCode: null }]);
    mockFindNextByDecisionForExtension.mockResolvedValue({ id: "A2", stepOrder: 2, stepKey: "S2" });

    const result = await approveExtension(
      "EXT1",
      { decision: "APPROVED" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual({
      extensionId: "EXT1",
      leaveRequestId: "L1",
      decision: "APPROVED",
      stepKey: "S2",
      stepOrder: 2,
      newStatus: null,
    });
    expect(mockExtensionUpdateCurrentStep).toHaveBeenCalledWith("EXT1", "S2", 2, expect.any(Object));
    expect(mockExtensionUpdateById).not.toHaveBeenCalled();
  });

  it("approves final step and updates leave endAt", async () => {
    mockExtensionFindById.mockResolvedValue({ id: "EXT2", status: "PENDING", leaveRequestId: "L1" });
    mockExtensionFindByIdForUpdate.mockResolvedValue({
      id: "EXT2",
      status: "PENDING",
      leaveRequestId: "L1",
      currentEndAt: new Date("2026-06-15"),
      requestedEndAt: new Date("2026-06-20"),
    });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverRoleCode: null }]);
    mockFindNextByDecisionForExtension.mockResolvedValue(null);

    const result = await approveExtension(
      "EXT2",
      { decision: "APPROVED" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual({
      extensionId: "EXT2",
      leaveRequestId: "L1",
      decision: "APPROVED",
      stepKey: null,
      stepOrder: null,
      newStatus: "APPROVED",
    });
    expect(mockExtensionUpdateById).toHaveBeenCalledWith(
      "EXT2",
      expect.objectContaining({ status: "APPROVED", approvedAt: expect.any(Date) }),
      expect.any(Object)
    );
    expect(mockLeaveUpdateById).toHaveBeenCalledWith(
      "L1",
      { endAt: new Date("2026-06-20") },
      expect.any(Object)
    );
  });

  it("rejects extension and updates status", async () => {
    mockExtensionFindById.mockResolvedValue({ id: "EXT3", status: "PENDING", leaveRequestId: "L1" });
    mockExtensionFindByIdForUpdate.mockResolvedValue({ id: "EXT3", status: "PENDING", leaveRequestId: "L1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverRoleCode: null }]);

    const result = await approveExtension(
      "EXT3",
      { decision: "REJECTED", comments: "Too long" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual({
      extensionId: "EXT3",
      leaveRequestId: "L1",
      decision: "REJECTED",
      stepKey: null,
      stepOrder: null,
      newStatus: "REJECTED",
    });
    expect(mockExtensionUpdateById).toHaveBeenCalledWith(
      "EXT3",
      expect.objectContaining({ status: "REJECTED", rejectedAt: expect.any(Date) }),
      expect.any(Object)
    );
    expect(mockLeaveUpdateById).not.toHaveBeenCalled();
  });

  it("throws NotFoundError for non-existent extension", async () => {
    mockExtensionFindById.mockResolvedValue(null);

    await expect(
      approveExtension("NONEXISTENT", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when no pending approvals", async () => {
    mockExtensionFindById.mockResolvedValue({ id: "EXT4", status: "PENDING" });
    mockExtensionFindByIdForUpdate.mockResolvedValue({ id: "EXT4", status: "PENDING" });
    mockFindPending.mockResolvedValue([]);

    await expect(
      approveExtension("EXT4", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot approve already approved extension", async () => {
    mockExtensionFindById.mockResolvedValue({ id: "EXT5", status: "APPROVED" });

    await expect(
      approveExtension("EXT5", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
