// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCountByParentIdAndDecision = vi.fn();
const mockFindPendingByParentId = vi.fn();
const mockFindHistoryByParentId = vi.fn();
const mockApprovalFindById = vi.fn();
const mockParentApprovalUpdateDecision = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockFindNextByEntityAndDecision = vi.fn();
const mockUpdateCurrentStep = vi.fn();

vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    countByParentIdAndDecision: (...args: any[]) => mockCountByParentIdAndDecision(...args),
    findPendingByParentId: (...args: any[]) => mockFindPendingByParentId(...args),
    findHistoryByParentId: (...args: any[]) => mockFindHistoryByParentId(...args),
    updateParentDecision: (...args: any[]) => mockParentApprovalUpdateDecision(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findById: (...args: any[]) => mockApprovalFindById(...args),
    findNextByEntityAndDecision: (...args: any[]) => mockFindNextByEntityAndDecision(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockUpdateCurrentStep(...args),
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
  },
}));

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

import { parentDashboardService } from "@/services/parent/parent-dashboard.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountByParentIdAndDecision.mockResolvedValue(5);
  mockFindPendingByParentId.mockResolvedValue([{ id: "AP1", leaveRequestId: "LR1" }]);
  mockFindHistoryByParentId.mockResolvedValue([{ id: "AP1", decision: "APPROVED" }]);
  mockApprovalFindById.mockResolvedValue({ id: "AP1", approverParentId: "P1", leaveRequestId: "LR1", stepOrder: 1 });
  mockParentApprovalUpdateDecision.mockResolvedValue({ id: "AP1" });
  mockAuditRecord.mockResolvedValue({});
  mockOutboxPublish.mockResolvedValue(undefined);
  mockLeaveFindById.mockResolvedValue({ id: "LR1", status: "PENDING", studentId: "S1" });
  mockLeaveUpdateById.mockResolvedValue({ id: "LR1" });
  mockFindNextByEntityAndDecision.mockResolvedValue(null);
  mockUpdateCurrentStep.mockResolvedValue({ id: "LR1" });
});

describe("parentDashboardService.getStats", () => {
  it("returns stats counts", async () => {
    const result = await parentDashboardService.getStats("P1");

    expect(result).toEqual({ pendingCount: 5, approvedCount: 5, rejectedCount: 5 });
    expect(mockCountByParentIdAndDecision).toHaveBeenCalledTimes(3);
  });
});

describe("parentDashboardService.getPendingApprovals", () => {
  it("returns pending approvals", async () => {
    const result = await parentDashboardService.getPendingApprovals("P1");

    expect(result).toEqual([{ id: "AP1", leaveRequestId: "LR1" }]);
    expect(mockFindPendingByParentId).toHaveBeenCalledWith("P1");
  });
});

describe("parentDashboardService.getApprovalDetail", () => {
  it("returns approval detail for parent", async () => {
    const result = await parentDashboardService.getApprovalDetail("AP1", "P1");

    expect(result).toEqual({ id: "AP1", approverParentId: "P1", leaveRequestId: "LR1", stepOrder: 1 });
  });

  it("throws NotFoundError when approval not found", async () => {
    mockApprovalFindById.mockResolvedValue(null);

    await expect(parentDashboardService.getApprovalDetail("AP1", "P1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when approval does not belong to parent", async () => {
    mockApprovalFindById.mockResolvedValue({ id: "AP1", approverParentId: "P2", leaveRequestId: "LR1" });

    await expect(parentDashboardService.getApprovalDetail("AP1", "P1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("parentDashboardService.submitDecision", () => {
  it("approves a leave request via portal", async () => {
    const result = await parentDashboardService.submitDecision("AP1", "P1", "APPROVED", "All good");

    expect(result).toEqual({ approvalId: "AP1", decision: "APPROVED" });
    expect(mockParentApprovalUpdateDecision).toHaveBeenCalledWith("AP1", "P1", "APPROVED", "All good", expect.any(Object), "PORTAL");
    expect(mockLeaveUpdateById).toHaveBeenCalledWith("LR1", expect.objectContaining({ status: "APPROVED" }), expect.any(Object));
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_APPROVED" }),
      expect.any(Object)
    );
  });

  it("rejects a leave request via portal", async () => {
    const result = await parentDashboardService.submitDecision("AP1", "P1", "REJECTED", "Not needed");

    expect(result).toEqual({ approvalId: "AP1", decision: "REJECTED" });
    expect(mockLeaveUpdateById).toHaveBeenCalledWith("LR1", expect.objectContaining({ status: "REJECTED" }), expect.any(Object));
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_REJECTED" }),
      expect.any(Object)
    );
  });

  it("throws ConflictError when approval does not belong to parent", async () => {
    mockApprovalFindById.mockResolvedValue({ id: "AP1", approverParentId: "P2", leaveRequestId: "LR1" });

    await expect(parentDashboardService.submitDecision("AP1", "P1", "APPROVED")).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when approval not found", async () => {
    mockApprovalFindById.mockResolvedValue(null);

    await expect(parentDashboardService.submitDecision("AP1", "P1", "APPROVED")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("advances to next approval step when leaves remain", async () => {
    mockFindNextByEntityAndDecision.mockResolvedValue({ id: "A2", stepKey: "WARDEN", stepOrder: 2 });

    const result = await parentDashboardService.submitDecision("AP1", "P1", "APPROVED");

    expect(result).toEqual({ approvalId: "AP1", decision: "APPROVED" });
    expect(mockUpdateCurrentStep).toHaveBeenCalledWith("LR1", "WARDEN", 2, expect.any(Object));
    expect(mockLeaveUpdateById).not.toHaveBeenCalledWith("LR1", expect.objectContaining({ status: "APPROVED" }));
  });
});

describe("parentDashboardService.getHistory", () => {
  it("returns approval history", async () => {
    const result = await parentDashboardService.getHistory("P1");

    expect(result).toEqual([{ id: "AP1", decision: "APPROVED" }]);
    expect(mockFindHistoryByParentId).toHaveBeenCalledWith("P1");
  });
});
