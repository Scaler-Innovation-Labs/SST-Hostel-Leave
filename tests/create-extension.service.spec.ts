// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockLeaveFindOverlapping = vi.fn().mockResolvedValue([]);
const mockPassFindByLeaveRequestId = vi.fn().mockResolvedValue(null);
const mockPassUpdateExpiresAt = vi.fn().mockResolvedValue({});
const mockExtensionCreate = vi.fn();
const mockExtensionFindById = vi.fn();
const mockExtensionFindByIdForUpdate = vi.fn();
const mockExtensionUpdateById = vi.fn();
const mockExtensionUpdateCurrentStep = vi.fn();
const mockExtensionGetNextExtensionNumber = vi.fn();
const mockApprovalCreateMany = vi.fn();
const mockAuditRecord = vi.fn();
const mockWorkflowResolve = vi.fn();
const mockWorkflowGetFirstStep = vi.fn();
const mockWorkflowGetNextStep = vi.fn().mockReturnValue(undefined);
const mockStudentFindByUserId = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockStudentFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    findOverlappingLeaves: (...args: any[]) => mockLeaveFindOverlapping(...args),
  },
}));

const mockExtensionFindByLeaveRequestId = vi.fn();

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    create: (...args: any[]) => mockExtensionCreate(...args),
    findById: (...args: any[]) => mockExtensionFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockExtensionFindByIdForUpdate(...args),
    findByLeaveRequestId: (...args: any[]) => mockExtensionFindByLeaveRequestId(...args),
    updateById: (...args: any[]) => mockExtensionUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockExtensionUpdateCurrentStep(...args),
    getNextExtensionNumber: (...args: any[]) => mockExtensionGetNextExtensionNumber(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    createMany: (...args: any[]) => mockApprovalCreateMany(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) => mockPassFindByLeaveRequestId(...args),
    updateExpiresAt: (...args: any[]) => mockPassUpdateExpiresAt(...args),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findPrimaryByStudentId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({ id: "U1", fullName: "Test Student" }),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/workflow/workflow-engine", () => ({
  workflowEngine: {
    resolve: (...args: any[]) => mockWorkflowResolve(...args),
    getFirstStep: (...args: any[]) => mockWorkflowGetFirstStep(...args),
    getNextStep: (...args: any[]) => mockWorkflowGetNextStep(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: vi.fn().mockResolvedValue({
      id: "LT1",
      code: "HOME_PASS",
      allowExtensions: true,
      defaultWorkflowId: "WF1",
    }),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createExtension } from "@/services/leave/create-extension.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPolicyEvaluate = vi.fn();

vi.mock("@/services/policy/policy-engine", () => ({
  policyEngine: {
    evaluate: (...args: any[]) => mockPolicyEvaluate(...args),
  },
}));

beforeEach(async () => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockExtensionCreate.mockResolvedValue({
    id: "EXT1",
    leaveRequestId: "L1",
    extensionNumber: 1,
    status: "PENDING",
  });
  mockExtensionGetNextExtensionNumber.mockResolvedValue(1);
  mockExtensionFindById.mockResolvedValue(null);
  mockExtensionFindByLeaveRequestId.mockResolvedValue([]);
  const { leaveTypeRepository } = await import("@/db/repositories/leave/leave-type.repository");
  (leaveTypeRepository.findById as any).mockResolvedValue({
    id: "LT1",
    code: "HOME_PASS",
    allowExtensions: true,
    maxExtensionCount: 3,
    defaultWorkflowId: "WF1",
    qrMode: "NONE",
  });
  mockPolicyEvaluate.mockResolvedValue({ allowed: true, restrictions: [] });
  mockApprovalCreateMany.mockResolvedValue([{ id: "AP1" }]);
  mockLeaveFindOverlapping.mockResolvedValue([]);
  mockWorkflowResolve.mockResolvedValue({
    steps: [
      { stepKey: "WARDEN", stepOrder: 1, approverRoleId: "ROLE1" },
    ],
  });
  mockWorkflowGetFirstStep.mockReturnValue({ stepKey: "WARDEN", stepOrder: 1 });
});

describe("createExtension service", () => {
  it("creates an extension for an APPROVED leave", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L1",
      status: "APPROVED",
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockLeaveFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });

    const result = await createExtension(
      "L1",
      {
        requestedEndAt: "2026-06-20T23:59:59Z",
        reason: "Need more time",
      },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual({
      extensionId: "EXT1",
      leaveRequestId: "L1",
      extensionNumber: 1,
      requestedEndAt: new Date("2026-06-20T23:59:59Z"),
      status: "PENDING",
    });
    expect(mockExtensionCreate).toHaveBeenCalled();
    expect(mockApprovalCreateMany).toHaveBeenCalled();
  });

  it("rejects extension for PENDING leave", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L2",
      status: "PENDING",
      endAt: new Date("2026-06-15"),
    });

    await expect(
      createExtension(
        "L2",
        { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Test" },
        { id: "U1", roles: ["ADMIN"] }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects extension for REJECTED leave", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L3",
      status: "REJECTED",
      endAt: new Date("2026-06-15"),
    });

    await expect(
      createExtension(
        "L3",
        { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Test" },
        { id: "U1", roles: ["ADMIN"] }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects extension end date before current end date", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L4",
      status: "APPROVED",
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });

    await expect(
      createExtension(
        "L4",
        { requestedEndAt: "2026-06-10T23:59:59Z", reason: "Test" },
        { id: "U1", roles: ["ADMIN"] }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for non-existent leave", async () => {
    mockLeaveFindById.mockResolvedValue(null);

    await expect(
      createExtension(
        "NONEXISTENT",
        { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Test" },
        { id: "U1", roles: ["ADMIN"] }
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("auto-approves extension with no overlap conflict", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockLeaveFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockWorkflowResolve.mockResolvedValue({
      steps: [{ stepKey: "AUTO1", stepOrder: 1, approverRoleId: null, approvalMethod: "AUTO" }],
    });
    mockWorkflowGetFirstStep.mockReturnValue({ stepKey: "AUTO1", stepOrder: 1, approvalMethod: "AUTO" });
    mockLeaveFindOverlapping.mockResolvedValue([]);

    const result = await createExtension(
      "L1",
      { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Need more time" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result.status).toBe("PENDING");
    expect(mockLeaveUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ endAt: new Date("2026-06-20T23:59:59Z") }),
      expect.anything()
    );
    expect(mockLeaveFindOverlapping).toHaveBeenCalled();
  });

  it("extends the QR pass window on AUTO approval (T14)", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockLeaveFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockWorkflowResolve.mockResolvedValue({
      steps: [{ stepKey: "AUTO1", stepOrder: 1, approverRoleId: null, approvalMethod: "AUTO" }],
    });
    mockWorkflowGetFirstStep.mockReturnValue({ stepKey: "AUTO1", stepOrder: 1, approvalMethod: "AUTO" });
    const { leaveTypeRepository } = await import("@/db/repositories/leave/leave-type.repository");
    (leaveTypeRepository.findById as any).mockResolvedValue({
      id: "LT1",
      code: "HOME_PASS",
      allowExtensions: true,
      maxExtensionCount: 3,
      defaultWorkflowId: "WF1",
      qrMode: "BOTH",
    });
    mockPassFindByLeaveRequestId.mockResolvedValue({ id: "QP1", status: "ACTIVE" });

    await createExtension(
      "L1",
      { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Need more time" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockPassUpdateExpiresAt).toHaveBeenCalledWith(
      "QP1",
      new Date(new Date("2026-06-20T23:59:59Z").getTime() + 24 * 60 * 60 * 1000),
      expect.anything()
    );
  });

  it("rejects auto-approved extension overlapping a QR-enabled leave", async () => {
    mockLeaveFindById.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockLeaveFindByIdForUpdate.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      startAt: new Date("2026-06-10"),
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });
    mockWorkflowResolve.mockResolvedValue({
      steps: [{ stepKey: "AUTO1", stepOrder: 1, approverRoleId: null, approvalMethod: "AUTO" }],
    });
    mockWorkflowGetFirstStep.mockReturnValue({ stepKey: "AUTO1", stepOrder: 1, approvalMethod: "AUTO" });
    const { leaveTypeRepository } = await import("@/db/repositories/leave/leave-type.repository");
    (leaveTypeRepository.findById as any).mockResolvedValue({
      id: "LT1",
      code: "HOME_PASS",
      allowExtensions: true,
      maxExtensionCount: 3,
      defaultWorkflowId: "WF1",
      qrMode: "BOTH",
    });
    mockLeaveFindOverlapping.mockResolvedValue([
      { leave: { id: "LR-OTHER", leaveTypeId: "LT-OTHER" }, leaveType: { qrMode: "BOTH" } },
    ]);

    await expect(
      createExtension(
        "L1",
        { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Need more time" },
        { id: "U1", roles: ["ADMIN"] }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a student extending another student's leave (IDOR guard)", async () => {
    mockStudentFindByUserId.mockResolvedValue({ id: "S-OTHER", userId: "U2" });

    mockLeaveFindById.mockResolvedValue({
      id: "L1",
      studentId: "S1",
      status: "APPROVED",
      endAt: new Date("2026-06-15"),
      leaveTypeId: "LT1",
    });

    await expect(
      createExtension(
        "L1",
        { requestedEndAt: "2026-06-20T23:59:59Z", reason: "Need more time" },
        { id: "U2", roles: ["STUDENT"] }
      )
    ).rejects.toBeInstanceOf((await import("@/lib/errors")).AuthorizationError);
  });
});
