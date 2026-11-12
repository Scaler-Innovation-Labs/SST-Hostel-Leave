import { describe, it, expect, vi, beforeEach } from "vitest";
import { resendExtensionParentApproval, resendParentApproval } from "@/services/parent/resend-parent-approval.service";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { ROLES } from "@/lib/auth/roles";
import { ConflictError } from "@/lib/errors";

vi.mock("@/lib/db", () => {
  const fakeTx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  };
  return {
    db: {
      transaction: vi.fn(async (cb) => cb(fakeTx)),
    },
  };
});

const mockLeaveFindById = vi.fn();
vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindById(...args),
  },
}));

const mockExtFindById = vi.fn();
vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findById: (...args: any[]) => mockExtFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockExtFindById(...args),
  },
}));

const mockApprovalFindByEntityAndDecision = vi.fn();
vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByEntityAndDecision: (...args: any[]) => mockApprovalFindByEntityAndDecision(...args),
  },
}));

const mockParentApprovalFindById = vi.fn();
vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    findById: (...args: any[]) => mockParentApprovalFindById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: vi.fn().mockResolvedValue({ id: "S1", userId: "U1" }),
    findByUserId: vi.fn().mockResolvedValue({ id: "S1" }),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({ id: "U1", fullName: "Test Student" }),
  },
}));

const mockOutboxPublish = vi.fn();
vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockOutboxPublish(...args),
  },
}));

const mockAuditRecord = vi.fn();
vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

describe("resend-parent-approval service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const superAdmin = {
    id: "ADMIN_1",
    role: ROLES.SUPER_ADMIN,
    roles: [ROLES.SUPER_ADMIN],
    email: "admin@scaler.com",
    fullName: "Admin",
  };

  it("successfully resends parent approval for a pending leave", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "LR1",
      studentId: "S1",
      status: LEAVE_REQUEST_STATUS.PENDING,
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
    });

    mockApprovalFindByEntityAndDecision.mockResolvedValue([
      {
        id: "AP1",
        stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL,
        stepOrder: 1,
      },
    ]);

    mockParentApprovalFindById.mockResolvedValue({
      id: "AP1",
      parentDetails: {
        parentId: "P1",
        tokenHash: "hash123",
      },
    });

    const res = await resendParentApproval("LR1", superAdmin as any);

    expect(res.success).toBe(true);
    expect(mockOutboxPublish).toHaveBeenCalledTimes(1);
    expect(mockAuditRecord).toHaveBeenCalledTimes(1);
  });

  it("successfully resends parent approval for a pending extension", async () => {
    mockExtFindById.mockResolvedValue({
      id: "EXT1",
      leaveRequestId: "LR1",
      status: LEAVE_REQUEST_STATUS.PENDING,
      currentStepOrder: 1,
      reason: "Delayed tickets",
      currentEndAt: new Date().toISOString(),
      requestedEndAt: new Date().toISOString(),
    });

    mockLeaveFindById.mockResolvedValue({
      id: "LR1",
      studentId: "S1",
    });

    mockApprovalFindByEntityAndDecision.mockResolvedValue([
      {
        id: "AP_EXT1",
        stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL,
        stepOrder: 1,
      },
    ]);

    mockParentApprovalFindById.mockResolvedValue({
      id: "AP_EXT1",
      parentDetails: {
        parentId: "P1",
        tokenHash: "hash123",
      },
    });

    const res = await resendExtensionParentApproval("EXT1", superAdmin as any);

    expect(res.success).toBe(true);
    expect(mockOutboxPublish).toHaveBeenCalledTimes(1);
    expect(mockAuditRecord).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictError if extension parent step is not pending", async () => {
    mockExtFindById.mockResolvedValue({
      id: "EXT1",
      leaveRequestId: "LR1",
      status: LEAVE_REQUEST_STATUS.APPROVED,
    });

    await expect(
      resendExtensionParentApproval("EXT1", superAdmin as any)
    ).rejects.toThrow(ConflictError);
  });
});
