// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockFindOverlapping = vi.fn().mockResolvedValue([]);
const mockFindStudentByUserId = vi.fn().mockResolvedValue({ id: "S1", userId: "U1" });
const mockFindStudentForUpdate = vi.fn();
const mockFindLeaveTypeById = vi.fn().mockResolvedValue({
  id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", allowExtensions: true, maxExtensionCount: 2, qrMode: "NONE",
});
const mockPolicyEvaluate = vi.fn().mockResolvedValue({ allowed: true, workflowId: "WF1", restrictions: [], requirements: [], checks: [], evaluations: [] });
const mockWorkflowResolve = vi.fn().mockResolvedValue({
  definition: { id: "WF1", isActive: true, version: 1 },
  steps: [{ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" }],
});
const mockWorkflowFirstStep = vi.fn().mockReturnValue({ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" });
const mockLeaveCreate = vi.fn().mockResolvedValue({ id: "LR1", requestNumber: "LR-1" });
const mockNextRequestNumber = vi.fn().mockResolvedValue("LR-1");
const mockApprovalCreateMany = vi.fn().mockResolvedValue([]);
const mockAuditRecord = vi.fn().mockResolvedValue({});

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

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    create: (...args: any[]) => mockLeaveCreate(...args),
    nextRequestNumber: (...args: any[]) => mockNextRequestNumber(...args),
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

const mockParentFindById = vi.fn();
const mockParentFindPrimary = vi.fn().mockResolvedValue({ id: "P1", studentId: "S1", phone: "9876543210" });

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
    findPrimaryByStudentId: (...args: any[]) => mockParentFindPrimary(...args),
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

const mockLeaveTypeVersionGetOrCreate = vi.fn().mockResolvedValue({ id: "LTV1", version: 1 });
const mockWorkflowVersionGetOrCreate = vi.fn().mockResolvedValue({ id: "WV1", version: 1 });
const mockContextCreate = vi.fn().mockResolvedValue({ id: "LCC1" });
const mockPolicyEvaluationCreateMany = vi.fn().mockResolvedValue([]);

vi.mock("@/services/leave/leave-type-version.service", () => ({
  leaveTypeVersionService: {
    getLatestVersion: (...args: any[]) => mockLeaveTypeVersionGetOrCreate(...args),
  },
}));

vi.mock("@/services/workflow/workflow-version.service", () => ({
  workflowVersionService: {
    getLatestVersion: (...args: any[]) => mockWorkflowVersionGetOrCreate(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-configuration-context.repository", () => ({
  leaveConfigurationContextRepository: {
    create: (...args: any[]) => mockContextCreate(...args),
  },
}));

vi.mock("@/db/repositories/policy/policy-evaluation.repository", () => ({
  policyEvaluationRepository: {
    createMany: (...args: any[]) => mockPolicyEvaluationCreateMany(...args),
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    vi.clearAllMocks();
    mockFindStudentByUserId.mockResolvedValue({ id: "S1", userId: "U1" });
    mockFindOverlapping.mockResolvedValue([]);
    mockFindLeaveTypeById.mockResolvedValue({
      id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", allowExtensions: true, maxExtensionCount: 2, qrMode: "NONE",
    });
    mockPolicyEvaluate.mockResolvedValue({ allowed: true, workflowId: "WF1", restrictions: [], requirements: [], checks: [], evaluations: [] });
    mockWorkflowResolve.mockResolvedValue({
      definition: { id: "WF1", isActive: true, version: 1 },
      steps: [{ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" }],
    });
    mockWorkflowFirstStep.mockReturnValue({ stepKey: "S1", stepOrder: 1, approverRoleId: "R1" });
    mockLeaveCreate.mockResolvedValue({ id: "LR1", requestNumber: "LR-1" });
    mockNextRequestNumber.mockResolvedValue("LR-1");
    mockApprovalCreateMany.mockResolvedValue([]);
    mockAuditRecord.mockResolvedValue({});
    mockLeaveTypeVersionGetOrCreate.mockResolvedValue({ id: "LTV1", version: 1 });
    mockWorkflowVersionGetOrCreate.mockResolvedValue({ id: "WV1", version: 1 });
    mockContextCreate.mockResolvedValue({ id: "LCC1" });
    mockPolicyEvaluationCreateMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("throws ConflictError when same-type non-QR overlap exists", async () => {
    mockFindOverlapping.mockResolvedValue([
      { leave: { id: "LR-EXISTING", leaveTypeId: "LT1" }, leaveType: { qrMode: "NONE" } },
    ]);

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects QR-enabled leave overlapping any existing leave", async () => {
    mockFindLeaveTypeById.mockResolvedValue({
      id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", allowExtensions: true, maxExtensionCount: 2, qrMode: "BOTH",
    });
    mockFindOverlapping.mockResolvedValue([
      { leave: { id: "LR-EXISTING", leaveTypeId: "LT-OTHER" }, leaveType: { qrMode: "NONE" } },
    ]);

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects non-QR leave overlapping a QR-enabled leave", async () => {
    mockFindOverlapping.mockResolvedValue([
      { leave: { id: "LR-EXISTING", leaveTypeId: "LT-OTHER" }, leaveType: { qrMode: "BOTH" } },
    ]);

    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows non-QR overlap with a different non-QR leave type", async () => {
    mockFindOverlapping.mockResolvedValue([
      { leave: { id: "LR-EXISTING", leaveTypeId: "LT-OTHER" }, leaveType: { qrMode: "NONE" } },
    ]);

    const res = await createLeave(
      { leaveTypeId: "LT1", reason: "Going home", startAt: "2026-06-10T08:00:00Z", endAt: "2026-06-12T18:00:00Z" },
      { id: "U1" }
    );

    expect(res).toBeDefined();
    expect(mockLeaveCreate).toHaveBeenCalled();
  });

  it("throws ConflictError when policy restricts", async () => {
    mockPolicyEvaluate.mockResolvedValue({
      allowed: false,
      workflowId: "WF1",
      restrictions: ["Max 5 days allowed"],
      evaluations: [],
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

  it("rejects a leave that starts before today in IST", async () => {
    await expect(
      createLeave(
        { leaveTypeId: "LT1", reason: "Test", startAt: "2026-05-31T18:00:00Z", endAt: "2026-06-02T18:00:00Z" },
        { id: "U1" }
      )
    ).rejects.toThrow("Leave cannot start in the past");
  });

  it("allows a leave that started earlier today in IST", async () => {
    const res = await createLeave(
      { leaveTypeId: "LT1", reason: "Test", startAt: "2026-06-01T04:00:00Z", endAt: "2026-06-02T18:00:00Z" },
      { id: "U1" }
    );

    expect(res).toBeDefined();
    expect(mockLeaveCreate).toHaveBeenCalled();
  });

  describe("parent approval contact selection", () => {
    beforeEach(() => {
      mockWorkflowResolve.mockResolvedValue({
        definition: { id: "WF1", isActive: true, version: 1 },
        steps: [
          { stepKey: "PARENT_APPROVAL", stepOrder: 1, isParentApproval: true, approvalMethod: "SMS_LINK" },
        ],
      });
      mockWorkflowFirstStep.mockReturnValue({
        stepKey: "PARENT_APPROVAL",
        stepOrder: 1,
        isParentApproval: true,
      });
    });

    it("persists the selected contact ID when approvalContactId belongs to the student", async () => {
      mockParentFindById.mockResolvedValue({
        id: "P-MOTHER",
        studentId: "S1",
        name: "Jane Doe",
        phone: "9876543210",
        relationship: "Mother",
      });

      await createLeave(
        {
          leaveTypeId: "LT1",
          reason: "Going home for festival",
          startAt: "2026-06-10T08:00:00Z",
          endAt: "2026-06-12T18:00:00Z",
          approvalContactId: "P-MOTHER",
        },
        { id: "U1" }
      );

      expect(mockParentFindById).toHaveBeenCalledWith("P-MOTHER", expect.anything());
      expect(mockApprovalCreateMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            stepKey: "PARENT_APPROVAL",
          }),
        ]),
        expect.anything()
      );
    });

    it("rejects when approvalContactId belongs to another student", async () => {
      mockParentFindById.mockResolvedValue({
        id: "P-OTHER",
        studentId: "S-OTHER-STUDENT",
        name: "Stranger",
        phone: "9876543210",
        relationship: "Father",
      });

      await expect(
        createLeave(
          {
            leaveTypeId: "LT1",
            reason: "Going home for festival",
            startAt: "2026-06-10T08:00:00Z",
            endAt: "2026-06-12T18:00:00Z",
            approvalContactId: "P-OTHER",
          },
          { id: "U1" }
        )
      ).rejects.toThrow("Selected contact does not belong to this student");
    });

    it("rejects when selected contact has no phone number", async () => {
      mockParentFindById.mockResolvedValue({
        id: "P-NO-PHONE",
        studentId: "S1",
        name: "Jane Doe",
        phone: "",
        relationship: "Mother",
      });

      await expect(
        createLeave(
          {
            leaveTypeId: "LT1",
            reason: "Going home for festival",
            startAt: "2026-06-10T08:00:00Z",
            endAt: "2026-06-12T18:00:00Z",
            approvalContactId: "P-NO-PHONE",
          },
          { id: "U1" }
        )
      ).rejects.toThrow("Selected contact has no phone number");
    });

    it("falls back to primary parent when approvalContactId is omitted", async () => {
      mockParentFindPrimary.mockResolvedValue({
        id: "P-PRIMARY",
        studentId: "S1",
        phone: "9123456789",
      });

      await createLeave(
        {
          leaveTypeId: "LT1",
          reason: "Going home for festival",
          startAt: "2026-06-10T08:00:00Z",
          endAt: "2026-06-12T18:00:00Z",
        },
        { id: "U1" }
      );

      expect(mockParentFindPrimary).toHaveBeenCalledWith("S1", expect.anything());
      expect(mockApprovalCreateMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            stepKey: "PARENT_APPROVAL",
          }),
        ]),
        expect.anything()
      );
    });
  });
});
