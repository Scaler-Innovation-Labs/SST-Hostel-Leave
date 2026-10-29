// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTxClient = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([]),
  returning: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb(mockTxClient),
  },
}));

const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveCreate = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockLeaveUpdateCurrentStep = vi.fn();
const mockNextRequestNumber = vi.fn().mockResolvedValue("LR-101");
const mockFindOverlappingLeaves = vi.fn().mockResolvedValue([]);

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
    create: (...args: any[]) => mockLeaveCreate(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockLeaveUpdateCurrentStep(...args),
    nextRequestNumber: (...args: any[]) => mockNextRequestNumber(...args),
    findOverlappingLeaves: (...args: any[]) => mockFindOverlappingLeaves(...args),
  },
}));

const mockApprovalCreateMany = vi.fn();
const mockFindPendingByEntity = vi.fn();
const mockFindNextByEntityAndDecision = vi.fn();
const mockAutoApprove = vi.fn();
const mockUpdateDecisionById = vi.fn();

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    createMany: (...args: any[]) => mockApprovalCreateMany(...args),
    findByEntityAndDecision: (...args: any[]) => mockFindPendingByEntity(...args),
    findNextByEntityAndDecision: (...args: any[]) => mockFindNextByEntityAndDecision(...args),
    autoApprove: (...args: any[]) => mockAutoApprove(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

const mockLeaveParentApprovalFindById = vi.fn();
vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    findById: (...args: any[]) => mockLeaveParentApprovalFindById(...args),
  },
}));

const mockStudentFindByUserId = vi.fn();
const mockStudentFindByIdForUpdate = vi.fn();
const mockStudentFindById = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockStudentFindByUserId(...args),
    findByIdForUpdate: (...args: any[]) => mockStudentFindByIdForUpdate(...args),
    findById: (...args: any[]) => mockStudentFindById(...args),
  },
}));

const mockLeaveTypeFindById = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
  },
}));

const mockParentFindById = vi.fn();
const mockParentFindPrimary = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
    findPrimaryByStudentId: (...args: any[]) => mockParentFindPrimary(...args),
  },
}));

const mockPolicyEvaluate = vi.fn();
vi.mock("@/services/policy/policy-engine", () => ({
  policyEngine: {
    evaluate: (...args: any[]) => mockPolicyEvaluate(...args),
  },
}));

const mockWorkflowResolve = vi.fn();
vi.mock("@/services/workflow/workflow-engine", () => ({
  workflowEngine: {
    resolve: (...args: any[]) => mockWorkflowResolve(...args),
    getFirstStep: (steps: any[]) => (steps.length ? steps[0] : null),
    getNextStep: (steps: any[], currentOrder: number) =>
      steps.find((s) => s.stepOrder > currentOrder) ?? null,
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

vi.mock("@/services/leave/leave-type-version.service", () => ({
  leaveTypeVersionService: {
    getLatestVersion: vi.fn().mockResolvedValue({ id: "LTV1" }),
  },
}));

vi.mock("@/services/workflow/workflow-version.service", () => ({
  workflowVersionService: {
    getLatestVersion: vi.fn().mockResolvedValue({ id: "WFV1" }),
  },
}));

vi.mock("@/db/repositories/leave/leave-configuration-context.repository", () => ({
  leaveConfigurationContextRepository: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/db/repositories/policy/policy-evaluation.repository", () => ({
  policyEvaluationRepository: {
    createMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({ id: "U1", fullName: "Test Student" }),
  },
}));

vi.mock("@/services/leave/qr-pass-lifecycle.service", () => ({
  issueQrPassForApprovedLeave: vi.fn().mockResolvedValue({ id: "QP1" }),
}));

import { createLeave } from "@/services/leave/create-leave.service";
import { approveLeave } from "@/services/leave/approve-leave.service";
import { resendParentApproval } from "@/services/parent/resend-parent-approval.service";

describe("Workflow Step Activation (B2: AUTO activation & B3: Parent timing)", () => {
  const baseStudent = { id: "S1", userId: "U1" };
  const baseLeaveType = {
    id: "LT1",
    code: "GENERAL_LEAVE",
    name: "General Leave",
    defaultWorkflowId: "WF1",
    qrMode: "BOTH",
    formSchema: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindByUserId.mockResolvedValue(baseStudent);
    mockStudentFindByIdForUpdate.mockResolvedValue(baseStudent);
    mockStudentFindById.mockResolvedValue(baseStudent);
    mockLeaveTypeFindById.mockResolvedValue(baseLeaveType);
    mockPolicyEvaluate.mockResolvedValue({
      allowed: true,
      restrictions: [],
      requirements: [],
      checks: [],
      evaluations: [],
    });
    mockParentFindPrimary.mockResolvedValue({
      id: "P1",
      studentId: "S1",
      phone: "+919876543210",
      email: "parent@example.com",
    });
    mockLeaveCreate.mockResolvedValue({
      id: "LR1",
      studentId: "S1",
      leaveTypeId: "LT1",
      status: "PENDING",
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-03T10:00:00Z"),
      currentStepKey: "POC_APPROVAL",
      currentStepOrder: 1,
    });
    mockLeaveFindById.mockResolvedValue({
      id: "LR1",
      studentId: "S1",
      leaveTypeId: "LT1",
      status: "PENDING",
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-03T10:00:00Z"),
      currentStepKey: "POC_APPROVAL",
      currentStepOrder: 1,
    });
    mockLeaveFindByIdForUpdate.mockResolvedValue({
      id: "LR1",
      studentId: "S1",
      leaveTypeId: "LT1",
      status: "PENDING",
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-03T10:00:00Z"),
      currentStepKey: "POC_APPROVAL",
      currentStepOrder: 1,
    });
    mockApprovalCreateMany.mockImplementation(async (approvals) => {
      return approvals.map((a: any, idx: number) => ({
        id: `A${idx + 1}`,
        ...a,
      }));
    });
  });

  describe("B2: [POC, AUTO] Workflow", () => {
    it("does NOT auto-approve when POC approval is the first step (respects workflow cursor)", async () => {
      // Step 1: POC (PORTAL), Step 2: AUTO
      mockWorkflowResolve.mockResolvedValue({
        definition: { id: "WF1", isActive: true },
        steps: [
          { stepKey: "POC_APPROVAL", stepOrder: 1, approvalMethod: "PORTAL" },
          { stepKey: "AUTO_APPROVAL", stepOrder: 2, approvalMethod: "AUTO" },
        ],
      });

      await createLeave(
        {
          leaveTypeId: "LT1",
          reason: "Attending hackathon",
          startAt: "2026-11-01T10:00:00Z",
          endAt: "2026-11-03T10:00:00Z",
          pocId: "U_POC",
        },
        { id: "U1" }
      );

      // AUTO must NOT be approved during leave creation
      expect(mockAutoApprove).not.toHaveBeenCalled();
      // Leave must remain PENDING at step 1
      expect(mockLeaveUpdateById).not.toHaveBeenCalledWith(
        "LR1",
        expect.objectContaining({ status: "APPROVED" }),
        expect.anything()
      );
    });

    it("activates and executes AUTO when POC approves, completing the leave", async () => {
      // Current step is POC (step 1)
      mockFindPendingByEntity.mockResolvedValue([
        { id: "A1", stepOrder: 1, stepKey: "POC_APPROVAL", assignedApproverUserId: "U_POC" },
      ]);
      mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
      // Next step is AUTO (step 2)
      mockFindNextByEntityAndDecision.mockResolvedValueOnce({
        id: "A2",
        stepOrder: 2,
        stepKey: "AUTO_APPROVAL",
        approvalSource: "SYSTEM",
        metadata: { approvalMethod: "AUTO" },
      });
      // After AUTO approves, there is no step 3
      mockFindNextByEntityAndDecision.mockResolvedValueOnce(null);

      const result = await approveLeave(
        "LR1",
        { decision: "APPROVED" },
        { id: "U_POC", roles: ["POC"] }
      );

      expect(result.decision).toBe("APPROVED");
      // AUTO step was auto-approved
      expect(mockAutoApprove).toHaveBeenCalledWith("A2", expect.anything());
      // Leave transitioned to APPROVED after final AUTO step
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR1",
        expect.objectContaining({ status: "APPROVED" }),
        expect.anything()
      );
    });
  });

  describe("B3: [POC, PARENT, ADMIN] Workflow (Parent Approval Timing)", () => {
    it("does NOT publish PARENT_APPROVAL_REQUIRED when parent approval is a later step", async () => {
      mockWorkflowResolve.mockResolvedValue({
        definition: { id: "WF1", isActive: true },
        steps: [
          { stepKey: "POC_APPROVAL", stepOrder: 1, approvalMethod: "PORTAL" },
          { stepKey: "PARENT_APPROVAL", stepOrder: 2, isParentApproval: true, approvalMethod: "SMS_LINK" },
          { stepKey: "ADMIN_APPROVAL", stepOrder: 3, approvalMethod: "PORTAL" },
        ],
      });

      await createLeave(
        {
          leaveTypeId: "LT1",
          reason: "Going home",
          startAt: "2026-11-01T10:00:00Z",
          endAt: "2026-11-03T10:00:00Z",
          pocId: "U_POC",
        },
        { id: "U1" }
      );

      // PARENT_APPROVAL_REQUIRED must NOT be published at creation because POC is step 1!
      const parentRequiredCalls = mockOutboxPublish.mock.calls.filter(
        (call: any[]) => call[0].eventType === "PARENT_APPROVAL_REQUIRED"
      );
      expect(parentRequiredCalls.length).toBe(0);
    });

    it("publishes PARENT_APPROVAL_REQUIRED only when POC approves and parent step becomes current", async () => {
      // POC (step 1) approves
      mockFindPendingByEntity.mockResolvedValue([
        { id: "A1", stepOrder: 1, stepKey: "POC_APPROVAL", assignedApproverUserId: "U_POC" },
      ]);
      mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
      // Next step is PARENT_APPROVAL (step 2)
      mockFindNextByEntityAndDecision.mockResolvedValueOnce({
        id: "A2",
        stepOrder: 2,
        stepKey: "PARENT_APPROVAL",
        approvalSource: "PORTAL",
        metadata: { isParentApproval: true },
      });

      await approveLeave(
        "LR1",
        { decision: "APPROVED" },
        { id: "U_POC", roles: ["POC"] }
      );

      // NOW PARENT_APPROVAL_REQUIRED must be emitted!
      const parentRequiredCalls = mockOutboxPublish.mock.calls.filter(
        (call: any[]) => call[0].eventType === "PARENT_APPROVAL_REQUIRED"
      );
      expect(parentRequiredCalls.length).toBe(1);
      expect(parentRequiredCalls[0][0].payload.approvalStepId).toBe("A2");
    });
  });

  describe("Resend Parent Approval", () => {
    it("successfully resends when parent approval is currently pending", async () => {
      const parentStepLeave = {
        id: "LR1",
        studentId: "S1",
        status: "PENDING",
        currentStepKey: "PARENT_APPROVAL",
        currentStepOrder: 2,
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-03T10:00:00Z"),
        reason: "Going home",
      };
      mockLeaveFindByIdForUpdate.mockResolvedValue(parentStepLeave);
      mockFindPendingByEntity.mockResolvedValue([
        {
          id: "A2",
          stepKey: "PARENT_APPROVAL",
          stepOrder: 2,
          metadata: { isParentApproval: true },
        },
      ]);
      mockLeaveParentApprovalFindById.mockResolvedValue({
        id: "A2",
        parentDetails: { parentId: "P1" },
      });

      const result = await resendParentApproval("LR1", "U1");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Parent approval link resent");
      const parentRequiredCalls = mockOutboxPublish.mock.calls.filter(
        (call: any[]) => call[0].eventType === "PARENT_APPROVAL_REQUIRED"
      );
      expect(parentRequiredCalls.length).toBe(1);
      expect(parentRequiredCalls[0][0].idempotencyKey).toContain("resend");
    });

    it("rejects resending when parent approval is not currently pending", async () => {
      const pocStepLeave = {
        id: "LR1",
        studentId: "S1",
        status: "PENDING",
        currentStepKey: "POC_APPROVAL",
        currentStepOrder: 1,
      };
      mockLeaveFindByIdForUpdate.mockResolvedValue(pocStepLeave);
      mockFindPendingByEntity.mockResolvedValue([
        {
          id: "A1",
          stepKey: "POC_APPROVAL",
          stepOrder: 1,
        },
      ]);

      await expect(resendParentApproval("LR1", "U1")).rejects.toThrow(
        "Parent approval is not currently pending for this leave"
      );
    });
  });
});
