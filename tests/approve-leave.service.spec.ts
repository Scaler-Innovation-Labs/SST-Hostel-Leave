// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockFindPending = vi.fn();
const mockUpdateDecisionById = vi.fn();
const mockFindNextByDecision = vi.fn();
const mockUpdateCurrentStep = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();
const mockRecordMovement = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateCurrentStep: (...args: any[]) => mockUpdateCurrentStep(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByLeaveRequestAndDecision: (...args: any[]) => mockFindPending(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
    findNextByDecision: (...args: any[]) => mockFindNextByDecision(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { approveLeave } from "@/services/leave/approve-leave.service";
import { ConflictError, NotFoundError, AuthorizationError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
});

describe("approveLeave service", () => {
  it("approves first step and activates next step", async () => {
    mockFindById.mockResolvedValue({ id: "L1", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "PENDING" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
    mockFindNextByDecision.mockResolvedValue({ id: "A2", stepOrder: 2, stepKey: "S2" });
    mockUpdateCurrentStep.mockResolvedValue({ id: "L1" });

    const result = await approveLeave("L1", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({
      leaveId: "L1",
      decision: "APPROVED",
      stepKey: "S2",
      stepOrder: 2,
      newStatus: null,
    });
    expect(mockUpdateDecisionById).toHaveBeenCalledWith("A1", "APPROVED", "U1", undefined, expect.any(Date), expect.any(Object));
    expect(mockUpdateCurrentStep).toHaveBeenCalledWith("L1", "S2", 2, expect.any(Object));
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("approves final step and sets leave to APPROVED", async () => {
    mockFindById.mockResolvedValue({ id: "L2", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L2", status: "PENDING", studentId: "S1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
    mockFindNextByDecision.mockResolvedValue(null);
    mockUpdateById.mockResolvedValue({ id: "L2", status: "APPROVED" });

    const result = await approveLeave("L2", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({
      leaveId: "L2",
      decision: "APPROVED",
      stepKey: null,
      stepOrder: null,
      newStatus: "APPROVED",
    });
    expect(mockUpdateDecisionById).toHaveBeenCalled();
    expect(mockFindNextByDecision).toHaveBeenCalledWith("L2", 1, expect.any(String), expect.any(Object));
    expect(mockUpdateById).toHaveBeenCalled();
    expect(mockRecordMovement).toHaveBeenCalledWith({
      studentId: "S1",
      leaveRequestId: "L2",
      fromState: "IN_HOSTEL",
      toState: "APPROVED_LEAVE",
      eventType: "LEAVE_APPROVED",
      movementMethod: "SYSTEM",
      recordedBy: "U1",
      dbClient: expect.any(Object),
    });
  });

  it("rejects current step and sets leave to REJECTED", async () => {
    mockFindById.mockResolvedValue({ id: "L3", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L3", status: "PENDING" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "REJECTED" });
    mockUpdateById.mockResolvedValue({ id: "L3", status: "REJECTED" });

    const result = await approveLeave("L3", { decision: "REJECTED", comments: "Not ok" }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({
      leaveId: "L3",
      decision: "REJECTED",
      stepKey: null,
      stepOrder: null,
      newStatus: "REJECTED",
    });
    expect(mockUpdateDecisionById).toHaveBeenCalledWith("A1", "REJECTED", "U1", "Not ok", expect.any(Date), expect.any(Object));
    expect(mockUpdateById).toHaveBeenCalled();
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("cannot approve an already approved step", async () => {
    mockFindById.mockResolvedValue({ id: "L4", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L4", status: "PENDING" });
    mockFindPending.mockResolvedValue([]);

    await expect(approveLeave("L4", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot approve a rejected leave", async () => {
    mockFindById.mockResolvedValue({ id: "L5", status: "REJECTED" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L5", status: "REJECTED" });

    await expect(approveLeave("L5", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot skip approval order (enforced by pending ordering)", async () => {
    mockFindById.mockResolvedValue({ id: "L6", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L6", status: "PENDING" });
    mockFindPending.mockResolvedValue([
      { id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null },
      { id: "A2", stepOrder: 2, stepKey: "S2", approverUserId: null, approverRoleCode: null },
    ]);
    mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
    mockFindNextByDecision.mockResolvedValue({ id: "A2", stepOrder: 2, stepKey: "S2" });
    mockUpdateCurrentStep.mockResolvedValue({ id: "L6" });

    await approveLeave("L6", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] });

    expect(mockUpdateDecisionById).toHaveBeenCalledWith("A1", "APPROVED", "U1", undefined, expect.any(Date), expect.any(Object));
    expect(mockUpdateCurrentStep).toHaveBeenCalledWith("L6", "S2", 2, expect.any(Object));
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(approveLeave("NONEXISTENT", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws AuthorizationError when approver lacks required role", async () => {
    mockFindById.mockResolvedValue({ id: "L7", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L7", status: "PENDING" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: "WARDEN" }]);

    await expect(approveLeave("L7", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws ConflictError when approval already processed concurrently", async () => {
    mockFindById.mockResolvedValue({ id: "L8", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L8", status: "PENDING" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateDecisionById.mockResolvedValue(null);

    await expect(approveLeave("L8", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("final approval propagates recordMovement failure", async () => {
    mockFindById.mockResolvedValue({ id: "L9", status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L9", status: "PENDING", studentId: "S1" });
    mockFindPending.mockResolvedValue([{ id: "A1", stepOrder: 1, stepKey: "S1", approverUserId: null, approverRoleCode: null }]);
    mockUpdateDecisionById.mockResolvedValue({ id: "A1", decision: "APPROVED" });
    mockFindNextByDecision.mockResolvedValue(null);
    mockUpdateById.mockResolvedValue({ id: "L9", status: "APPROVED" });
    mockRecordMovement.mockRejectedValue(new ConflictError("Student state mismatch"));

    await expect(
      approveLeave("L9", { decision: "APPROVED" }, { id: "U1", roles: ["ADMIN"] })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
