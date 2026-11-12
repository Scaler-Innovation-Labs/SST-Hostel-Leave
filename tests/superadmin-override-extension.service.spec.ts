// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindExtensionByIdForUpdate = vi.fn();
const mockUpdateExtensionById = vi.fn();
const mockUpdateCurrentStep = vi.fn();
const mockFindLeaveByIdForUpdate = vi.fn();
const mockUpdateLeaveById = vi.fn();
const mockFindByLeaveExtensionId = vi.fn();
const mockFindByEntityAndDecision = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockReopenApproval = vi.fn();
const mockRecord = vi.fn();
const mockPublish = vi.fn();
const mockExtendQrPassWindow = vi.fn();
const mockAssertNoConflictingOverlap = vi.fn();
const mockFindLeaveTypeById = vi.fn();
const mockFindStudentById = vi.fn();
const mockUpdateCurrentLocationState = vi.fn();

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
    updateCurrentLocationState: (...args: any[]) => mockUpdateCurrentLocationState(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findByIdForUpdate: (...args: any[]) => mockFindExtensionByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateExtensionById(...args),
    updateCurrentStep: (...args: any[]) => mockUpdateCurrentStep(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByIdForUpdate: (...args: any[]) => mockFindLeaveByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateLeaveById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByLeaveExtensionId: (...args: any[]) => mockFindByLeaveExtensionId(...args),
    findByEntityAndDecision: (...args: any[]) => mockFindByEntityAndDecision(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
    reopenApproval: (...args: any[]) => mockReopenApproval(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindLeaveTypeById(...args),
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

vi.mock("@/services/leave/qr-pass-lifecycle.service", () => ({
  extendQrPassWindow: (...args: any[]) => mockExtendQrPassWindow(...args),
}));

vi.mock("@/services/leave/overlap-guard.service", () => ({
  assertNoConflictingOverlap: (...args: any[]) => mockAssertNoConflictingOverlap(...args),
}));

vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: vi.fn(),
}));

import { superadminOverrideExtension } from "@/services/leave/superadmin-override-extension.service";

describe("superadminOverrideExtension", () => {
  const superAdmin = { id: "user-superadmin", roles: ["SUPER_ADMIN"], role: "SUPER_ADMIN" };
  const mockExtension = {
    id: "ext-1",
    leaveRequestId: "leave-1",
    status: "PENDING",
    currentStepKey: "PARENT_APPROVAL",
    currentStepOrder: 1,
    requestedEndAt: new Date("2026-11-15T18:00:00Z"),
  };
  const mockLeave = {
    id: "leave-1",
    studentId: "student-1",
    leaveTypeId: "lt-1",
    status: "APPROVED",
    startAt: new Date("2026-11-10T10:00:00Z"),
    endAt: new Date("2026-11-12T18:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindExtensionByIdForUpdate.mockResolvedValue(mockExtension);
    mockFindLeaveByIdForUpdate.mockResolvedValue(mockLeave);
    mockFindLeaveTypeById.mockResolvedValue({ id: "lt-1", qrMode: "ONE_TIME" });
    mockFindStudentById.mockResolvedValue({ id: "student-1", currentLocationState: "OVERDUE" });
    mockFindByEntityAndDecision.mockResolvedValue([]);
    mockFindByLeaveExtensionId.mockResolvedValue([
      {
        id: "appr-1",
        stepKey: "PARENT_APPROVAL",
        stepOrder: 1,
        decision: "PENDING",
        isParentApproval: true,
      },
      {
        id: "appr-2",
        stepKey: "WARDEN_APPROVAL",
        stepOrder: 2,
        decision: "PENDING",
        isParentApproval: false,
      },
    ]);
  });

  it("successfully overrides ALL steps to finalize extension approval", async () => {
    const result = await superadminOverrideExtension("ext-1", "ALL", superAdmin, "Overriding all");

    expect(result.extensionId).toBe("ext-1");
    expect(result.mode).toBe("ALL");
    expect(result.approvalsOverridden).toBe(2);

    expect(mockUpdateLeaveById).toHaveBeenCalledWith(
      "leave-1",
      expect.objectContaining({ endAt: mockExtension.requestedEndAt }),
      expect.anything()
    );
    expect(mockUpdateExtensionById).toHaveBeenCalledWith(
      "ext-1",
      expect.objectContaining({ status: "APPROVED" }),
      expect.anything()
    );
    expect(mockExtendQrPassWindow).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalled();
  });

  it("successfully advances ONE_STEP", async () => {
    mockFindByEntityAndDecision.mockResolvedValue([
      { id: "appr-2", stepKey: "WARDEN_APPROVAL", stepOrder: 2 },
    ]);
    const result = await superadminOverrideExtension("ext-1", "ONE_STEP", superAdmin);

    expect(result.extensionId).toBe("ext-1");
    expect(result.mode).toBe("ONE_STEP");
    expect(result.approvalsOverridden).toBe(1);

    expect(mockUpdateCurrentStep).toHaveBeenCalledWith(
      "ext-1",
      "WARDEN_APPROVAL",
      2,
      expect.anything()
    );
  });

  it("recovers a REJECTED extension when overridden", async () => {
    mockFindExtensionByIdForUpdate.mockResolvedValue({
      ...mockExtension,
      status: "REJECTED",
    });
    mockFindByLeaveExtensionId.mockResolvedValue([
      {
        id: "appr-1",
        stepKey: "PARENT_APPROVAL",
        stepOrder: 1,
        decision: "REJECTED",
        isParentApproval: true,
      },
    ]);

    const result = await superadminOverrideExtension("ext-1", "ALL", superAdmin, "Recovering rejected");

    expect(result.extensionId).toBe("ext-1");
    expect(mockUpdateExtensionById).toHaveBeenCalledWith(
      "ext-1",
      expect.objectContaining({ status: "APPROVED" }),
      expect.anything()
    );
  });
});
