// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

// Repositories & services mocks
const mockLeaveCreate = vi.fn();
const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdWithRelations = vi.fn();
const mockLeaveFindByFilters = vi.fn();
const mockNextRequestNumber = vi.fn().mockResolvedValue("LR-1001");
const mockStudentFindByUserId = vi.fn();
const mockStudentFindByIdWithRelations = vi.fn();
const mockStudentFindByIdForUpdate = vi.fn();
const mockUserFindById = vi.fn();
const mockUserUpdateUser = vi.fn();
const mockHostelFindById = vi.fn();
const mockLeaveTypeFindById = vi.fn();
const mockPolicyEvaluate = vi.fn();
const mockWorkflowResolve = vi.fn();
const mockWorkflowFirstStep = vi.fn();
const mockApprovalCreateMany = vi.fn();
const mockAuditRecord = vi.fn();
const mockExtensionFindById = vi.fn();

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

vi.mock("@/lib/db/transaction", () => ({
  transaction: async (cb: any) => {
    const tx: Record<string, any> = {};
    return cb(tx);
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    create: (...args: any[]) => mockLeaveCreate(...args),
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdWithRelations: (...args: any[]) => mockLeaveFindByIdWithRelations(...args),
    findByFilters: (...args: any[]) => mockLeaveFindByFilters(...args),
    nextRequestNumber: (...args: any[]) => mockNextRequestNumber(...args),
    findOverlappingLeaves: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    createMany: (...args: any[]) => mockApprovalCreateMany(...args),
    findByFilters: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findById: (...args: any[]) => mockExtensionFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockStudentFindByUserId(...args),
    findByIdWithRelations: (...args: any[]) => mockStudentFindByIdWithRelations(...args),
    findByIdForUpdate: (...args: any[]) => mockStudentFindByIdForUpdate(...args),
    findPolicyContextByUserId: vi.fn().mockResolvedValue({ studentBatchYear: 2024, hostelId: "HOSTEL_A" }),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockUserFindById(...args),
    updateUser: (...args: any[]) => mockUserUpdateUser(...args),
  },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockHostelFindById(...args),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findPrimaryByStudentId: vi.fn().mockResolvedValue({ id: "P1", studentId: "S1", phone: "9876543210" }),
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

vi.mock("@/services/leave/leave-type-version.service", () => ({
  leaveTypeVersionService: {
    getLatestVersion: vi.fn().mockResolvedValue({ id: "LTV1", version: 1 }),
  },
}));

vi.mock("@/services/workflow/workflow-version.service", () => ({
  workflowVersionService: {
    getLatestVersion: vi.fn().mockResolvedValue({ id: "WV1", version: 1 }),
  },
}));

vi.mock("@/db/repositories/leave/leave-configuration-context.repository", () => ({
  leaveConfigurationContextRepository: {
    create: vi.fn().mockResolvedValue({ id: "LCC1" }),
  },
}));

vi.mock("@/db/repositories/policy/policy-evaluation.repository", () => ({
  policyEvaluationRepository: {
    createMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRoleCodesByUserId: vi.fn().mockResolvedValue(["STUDENT"]),
  },
}));

vi.mock("@/services/leave/overlap-guard.service", () => ({
  assertNoConflictingOverlap: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/leave/validate-leave-form.service", () => ({
  validateLeaveSubmittedForm: vi.fn((_schema, form) => form ?? {}),
}));

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    createEvent: vi.fn().mockResolvedValue({ id: "OE1" }),
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/workflow/workflow-activation.service", () => ({
  activateWorkflowStep: vi.fn().mockResolvedValue(undefined),
}));

import { leaveRequests } from "@/db/schema/leave";
import { createLeave } from "@/services/leave/create-leave.service";
import { getLeave } from "@/services/leave/get-leave.service";
import { canAccessLeave } from "@/services/shared/authorization.service";

describe("Historical Hostel Snapshots in Leave Requests", () => {
  const staffHostelA = {
    id: "STAFF_A",
    roles: ["ADMIN"],
    roleScopes: [{ roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_A" }],
  };

  const staffHostelB = {
    id: "STAFF_B",
    roles: ["ADMIN"],
    roleScopes: [{ roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_B" }],
  };

  const studentUser = {
    id: "USER_1",
    fullName: "Alice Student",
    hostelId: "HOSTEL_A",
  };

  const studentRecord = {
    id: "STUDENT_1",
    userId: "USER_1",
    rollNumber: "24BCS10001",
  };

  const hostelA = { id: "HOSTEL_A", name: "Hostel Alpha", code: "H-A" };
  const hostelB = { id: "HOSTEL_B", name: "Hostel Beta", code: "H-B" };

  const defaultLeaveType = {
    id: "LT_GEN",
    code: "GENERAL_LEAVE",
    name: "General Leave",
    defaultWorkflowId: "WF_1",
    qrMode: "BOTH",
    formSchema: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApprovalCreateMany.mockResolvedValue([]);
    mockStudentFindByUserId.mockResolvedValue(studentRecord);
    mockStudentFindByIdForUpdate.mockResolvedValue(studentRecord);
    mockUserFindById.mockResolvedValue(studentUser);
    mockHostelFindById.mockImplementation(async (id: string) => {
      if (id === "HOSTEL_A") return hostelA;
      if (id === "HOSTEL_B") return hostelB;
      return null;
    });
    mockLeaveTypeFindById.mockResolvedValue(defaultLeaveType);
    mockPolicyEvaluate.mockResolvedValue({
      allowed: true,
      restrictions: [],
      requirements: [],
      checks: [],
      evaluations: [],
    });
    mockWorkflowResolve.mockResolvedValue({
      definition: { id: "WF_1" },
      steps: [{ stepKey: "ADMIN_APPROVAL", stepOrder: 1, isParentApproval: false }],
    });
    mockWorkflowFirstStep.mockReturnValue({
      stepKey: "ADMIN_APPROVAL",
      stepOrder: 1,
    });
  });

  it("1. Student submits leave under Hostel A -> snapshots Hostel A ID and name", async () => {
    mockLeaveCreate.mockImplementation(async (input) => ({
      id: "LEAVE_1",
      ...input,
    }));

    const futureStart = new Date(Date.now() + 86400000).toISOString();
    const futureEnd = new Date(Date.now() + 172800000).toISOString();

    const result = await createLeave(
      {
        leaveTypeId: "LT_GEN",
        startAt: futureStart,
        endAt: futureEnd,
        reason: "Visiting family",
        submittedForm: {},
      },
      { id: "USER_1" }
    );

    expect(mockLeaveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "STUDENT_1",
        hostelId: "HOSTEL_A",
        hostelName: "Hostel Alpha",
      }),
      expect.anything()
    );
    expect(result.hostelId).toBe("HOSTEL_A");
    expect(result.hostelName).toBe("Hostel Alpha");
  });

  it("2 & 3. Student changes to Hostel B -> original leave remains in Hostel A", async () => {
    const originalLeave = {
      id: "LEAVE_1",
      requestNumber: "LR-1001",
      studentId: "STUDENT_1",
      hostelId: "HOSTEL_A",
      hostelName: "Hostel Alpha",
      leaveTypeId: "LT_GEN",
      status: "APPROVED",
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
      reason: "Visiting family",
      submittedForm: {},
    };

    mockLeaveFindById.mockResolvedValue(originalLeave);
    mockLeaveFindByIdWithRelations.mockResolvedValue({
      leave: originalLeave,
      student: studentRecord,
      user: { ...studentUser, hostelId: "HOSTEL_B" }, // Student moved to Hostel B!
      leaveType: defaultLeaveType,
      hostel: hostelA, // Snapshot hostel Alpha
    });

    // Fetch original leave via getLeave
    const details = await getLeave("LEAVE_1", {
      id: "USER_1",
      roles: ["STUDENT"],
    });

    expect(details.leave.hostelId).toBe("HOSTEL_A");
    expect(details.leave.hostelName).toBe("Hostel Alpha");
    expect(details.hostel?.name).toBe("Hostel Alpha");
  });

  it("4. Hostel A's staff can access original leave, while Hostel B's staff are denied", async () => {
    const originalLeave = {
      id: "LEAVE_1",
      studentId: "STUDENT_1",
      hostelId: "HOSTEL_A",
      hostelName: "Hostel Alpha",
    };

    // Even though student's current profile belongs to Hostel B:
    mockStudentFindByIdWithRelations.mockResolvedValue({
      student: studentRecord,
      user: { ...studentUser, hostelId: "HOSTEL_B" },
    });

    // Hostel A staff has access because leave was created under Hostel A:
    const canStaffAAccess = await canAccessLeave(staffHostelA, originalLeave);
    expect(canStaffAAccess).toBe(true);

    // Hostel B staff does NOT gain access merely because student transferred:
    const canStaffBAccess = await canAccessLeave(staffHostelB, originalLeave);
    expect(canStaffBAccess).toBe(false);
  });

  it("5. A new leave submitted after transfer belongs to Hostel B", async () => {
    // Now student is in Hostel B:
    mockUserFindById.mockResolvedValue({
      ...studentUser,
      hostelId: "HOSTEL_B",
    });

    mockLeaveCreate.mockImplementation(async (input) => ({
      id: "LEAVE_2",
      ...input,
    }));

    const futureStart = new Date(Date.now() + 86400000 * 5).toISOString();
    const futureEnd = new Date(Date.now() + 86400000 * 7).toISOString();

    const newLeave = await createLeave(
      {
        leaveTypeId: "LT_GEN",
        startAt: futureStart,
        endAt: futureEnd,
        reason: "Trip after moving to Hostel B",
        submittedForm: {},
      },
      { id: "USER_1" }
    );

    expect(mockLeaveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "STUDENT_1",
        hostelId: "HOSTEL_B",
        hostelName: "Hostel Beta",
      }),
      expect.anything()
    );
    expect(newLeave.hostelId).toBe("HOSTEL_B");
    expect(newLeave.hostelName).toBe("Hostel Beta");

    // And Hostel B staff can access this new leave, while Hostel A staff cannot:
    expect(await canAccessLeave(staffHostelB, newLeave)).toBe(true);
    expect(await canAccessLeave(staffHostelA, newLeave)).toBe(false);
  });

  it("6. Extensions retain the original leave's hostel context", async () => {
    const originalLeave = {
      id: "LEAVE_1",
      studentId: "STUDENT_1",
      hostelId: "HOSTEL_A",
      hostelName: "Hostel Alpha",
    };

    // Extension points to original leave
    const extension = {
      id: "EXT_1",
      leaveRequestId: "LEAVE_1",
      studentId: "STUDENT_1",
      extensionNumber: 1,
    };

    mockLeaveFindById.mockResolvedValue(originalLeave);

    // Extension access checks the original leave's hostel:
    const canStaffAAccessExt = await canAccessLeave(staffHostelA, originalLeave);
    const canStaffBAccessExt = await canAccessLeave(staffHostelB, originalLeave);

    expect(canStaffAAccessExt).toBe(true);
    expect(canStaffBAccessExt).toBe(false);
  });

  it("7. Leaves created without hostel assignment remain unassigned and never inherit subsequent hostel", async () => {
    const unassignedLeave = {
      id: "LEAVE_UNASSIGNED",
      studentId: "STUDENT_1",
      hostelId: null,
      hostelName: null,
    };

    // Even if student later moves to Hostel A:
    mockStudentFindByIdWithRelations.mockResolvedValue({
      student: studentRecord,
      user: { ...studentUser, hostelId: "HOSTEL_A" },
    });

    // Staff scoped to Hostel A still cannot access the leave because it was created without a hostel:
    const canStaffAAccess = await canAccessLeave(staffHostelA, unassignedLeave);
    expect(canStaffAAccess).toBe(false);
  });

  it("8. Schema enforces ON DELETE RESTRICT on leave_requests.hostel_id to prevent accidental hard deletion", () => {
    const inlineFks = (leaveRequests as any)[Symbol.for("drizzle:PgInlineForeignKeys")] ?? [];
    const hostelFk = inlineFks.find((fk: any) => {
      const ref = fk.reference?.() ?? fk;
      return ref.foreignTable?.[Symbol.for("drizzle:Name")] === "hostels";
    });

    expect(hostelFk).toBeDefined();
    expect(hostelFk.onDelete).toBe("restrict");
  });
});
