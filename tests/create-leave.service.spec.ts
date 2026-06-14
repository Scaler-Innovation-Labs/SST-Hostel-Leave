// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindOverlapping = vi.fn().mockResolvedValue([]);
const mockFindStudentByUserId = vi.fn().mockResolvedValue({ id: "S1", userId: "U1" });
const mockFindStudentForUpdate = vi.fn();
const mockFindLeaveTypeById = vi.fn().mockResolvedValue({
  id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", allowExtensions: true, maxExtensionCount: 2,
});
const mockPolicyEvaluate = vi.fn().mockResolvedValue({ allowed: true, workflowId: "WF1", restrictions: [] });
const mockWorkflowResolve = vi.fn().mockResolvedValue({
  definition: { id: "WF1", isActive: true, version: 1 },
  steps: [{ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" }],
});
const mockWorkflowFirstStep = vi.fn().mockReturnValue({ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" });
const mockLeaveCreate = vi.fn().mockResolvedValue({ id: "LR1", requestNumber: "LR-1" });
const mockApprovalCreateMany = vi.fn().mockResolvedValue([]);
const mockAuditRecord = vi.fn().mockResolvedValue({});

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    create: (...args: any[]) => mockLeaveCreate(...args),
    findOverlappingLeaves: (...args: any[]) => mockFindOverlapping(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    createMany: (...args: any[]) => mockApprovalCreateMany(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindLeaveTypeById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindStudentByUserId(...args),
    findByIdForUpdate: (...args: any[]) => mockFindStudentForUpdate(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/policy/policy-engine", () => ({
  policyEngine: {
    evaluate: (...args: any[]) => mockPolicyEvaluate(...args),
  },
}));

vi.mock("@/services/workflow/workflow-engine", () => ({
  workflowEngine: {
    resolve: (...args: any[]) => mockWorkflowResolve(...args),
    getFirstStep: (...args: any[]) => mockWorkflowFirstStep(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/db/repositories/auth/user.repository", () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({ id: "U1", fullName: "Test User" }),
  },
}));

vi.mock("@/services/parent/generate-parent-approval.service", () => ({
  generateParentApproval: vi.fn().mockResolvedValue(undefined),
}));

import { createLeave } from "@/services/leave/create-leave.service";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";

describe("createLeave service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindStudentByUserId.mockResolvedValue({ id: "S1", userId: "U1" });
    mockFindOverlapping.mockResolvedValue([]);
    mockFindLeaveTypeById.mockResolvedValue({
      id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", allowExtensions: true, maxExtensionCount: 2,
    });
    mockPolicyEvaluate.mockResolvedValue({ allowed: true, workflowId: "WF1", restrictions: [] });
    mockWorkflowResolve.mockResolvedValue({
      definition: { id: "WF1", isActive: true, version: 1 },
      steps: [{ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" }],
    });
    mockWorkflowFirstStep.mockReturnValue({ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" });
    mockLeaveCreate.mockResolvedValue({ id: "LR1", requestNumber: "LR-1" });
    mockApprovalCreateMany.mockResolvedValue([]);
    mockAuditRecord.mockResolvedValue({});
  });

  it("creates a leave and pending approvals", async () => {
    const dto = {
      leaveTypeId: "LT1",
      reason: "Going home",
      startAt: "2026-06-10T08:00:00Z",
      endAt: "2026-06-12T18:00:00Z",
    };

    const res = await createLeave(dto, { id: "U1" });

    expect(res).toBeDefined();
    expect(mockLeaveCreate).toHaveBeenCalled();
    expect(mockApprovalCreateMany).toHaveBeenCalled();
  });

  it("throws AuthorizationError when student not found", async () => {
    mockFindStudentByUserId.mockResolvedValue(null);

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws ConflictError when overlapping leave exists", async () => {
    mockFindOverlapping.mockResolvedValue([{ id: "LR-EXISTING" }]);

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when policy restricts", async () => {
    mockPolicyEvaluate.mockResolvedValue({
      allowed: false,
      workflowId: "WF1",
      restrictions: ["Max 5 days allowed"],
    });

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-20T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ValidationError when leave type has no workflow", async () => {
    mockFindLeaveTypeById.mockResolvedValue({
      id: "LT1", code: "MEDICAL", defaultWorkflowId: null, allowExtensions: false, maxExtensionCount: 0,
    });

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
