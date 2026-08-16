// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const { AuthorizationError } = vi.hoisted(() => {
  class AuthorizationError extends Error {
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError };
});

const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockUpdateCurrentStep = vi.fn();
const mockFindByLeaveRequestId = vi.fn();
const mockFindByEntityAndDecision = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockRecord = vi.fn();
const mockPublish = vi.fn();

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockUpdateCurrentStep(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindByLeaveRequestId(...args),
    findByEntityAndDecision: (...args: any[]) => mockFindByEntityAndDecision(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockRecord(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockPublish(...args),
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireRole: (user: any, role: string) => {
    if (!user?.roles?.includes(role)) {
      throw new AuthorizationError();
    }
    return user;
  },
}));

import { superadminOverrideLeave } from "@/services/leave/superadmin-override.service";

const SUPER = { id: "U1", roles: ["SUPER_ADMIN"] };
const ADMIN = { id: "U2", roles: ["ADMIN"] };

const PENDING_APPROVALS = [
  {
    id: "A1",
    stepKey: "POC_APPROVAL",
    stepOrder: 1,
    decision: "PENDING",
    approverUserId: "U9",
    approverParentId: null,
  },
  {
    id: "A2",
    stepKey: "ADMIN_APPROVAL",
    stepOrder: 2,
    decision: "PENDING",
    approverUserId: "U8",
    approverParentId: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDecisionById.mockResolvedValue({ id: "A1" });
  mockUpdateById.mockResolvedValue({ id: "L1" });
});

describe("superadminOverrideLeave", () => {
  it("rejects a non-super-admin caller", async () => {
    await expect(
      superadminOverrideLeave("L1", "ALL", ADMIN, "forcing")
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mockFindByIdForUpdate).not.toHaveBeenCalled();
  });

  it("rejects overriding a pending parent-approval step", async () => {
    mockFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "PENDING",
    });
    mockFindByLeaveRequestId.mockResolvedValue([
      {
        id: "P1",
        stepKey: "PARENT_APPROVAL",
        stepOrder: 1,
        decision: "PENDING",
        approverUserId: null,
        approverParentId: "PARENT-1",
      },
    ]);

    await expect(
      superadminOverrideLeave("L1", "ALL", SUPER, "forcing")
    ).rejects.toThrow("Parent approval steps cannot be overridden");
    expect(mockUpdateDecisionById).not.toHaveBeenCalled();
  });

  it("overrides all pending steps and approves the leave as super-admin", async () => {
    mockFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "PENDING",
    });
    mockFindByLeaveRequestId.mockResolvedValue(PENDING_APPROVALS);
    mockFindByEntityAndDecision.mockResolvedValue([]);

    const result = await superadminOverrideLeave("L1", "ALL", SUPER, "urgent");

    expect(mockUpdateDecisionById).toHaveBeenCalledTimes(2);
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "APPROVED" }),
      expect.anything()
    );
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_APPROVED" }),
      expect.anything()
    );
    expect(result).toEqual(
      expect.objectContaining({
        leaveId: "L1",
        mode: "ALL",
        newStatus: "APPROVED",
      })
    );
  });
});
