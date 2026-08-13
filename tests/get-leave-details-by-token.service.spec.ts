// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByParentApprovalToken = vi.fn();
const mockParentFindById = vi.fn();
const mockFindLeaveById = vi.fn();
const mockFindLeaveTypeById = vi.fn();

vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    findByParentApprovalToken: (...args: any[]) => mockFindByParentApprovalToken(...args),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindLeaveById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindLeaveTypeById(...args),
  },
}));

vi.mock("@/lib/crypto", () => ({
  sha256: vi.fn().mockResolvedValue("hashed-token"),
}));

import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

const MOCK_APPROVAL_LEAVE = {
  id: "AP1",
  leaveRequestId: "LR1",
  leaveExtensionId: null,
  decision: "PENDING",
  parentApprovalExpiresAt: new Date("2099-01-01"),
  approverParentId: "P1",
  stepOrder: 1,
  studentName: "John Doe",
  studentRollNumber: "R1",
  leaveRequest: { id: "LR1", leaveTypeId: "LT1", reason: "Family visit", startAt: new Date("2026-06-10"), endAt: new Date("2026-06-12"), submittedForm: null },
  leaveExtension: null,
  leaveExtensionId: null,
};

const MOCK_LEAVE_TYPE = {
  id: "LT1",
  name: "Internship",
  description: "Leave for internship-related travel",
};

const MOCK_PARENT = { id: "P1", name: "Parent Name", phone: "+1234567890" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByParentApprovalToken.mockResolvedValue(MOCK_APPROVAL_LEAVE);
  mockParentFindById.mockResolvedValue(MOCK_PARENT);
  mockFindLeaveById.mockResolvedValue({ id: "LR1", leaveTypeId: "LT1" });
  mockFindLeaveTypeById.mockResolvedValue(MOCK_LEAVE_TYPE);
});

describe("getLeaveDetailsByToken service", () => {
  it("returns leave details for a valid token", async () => {
    const result = await getLeaveDetailsByToken("valid-token");

    expect(result.approvalId).toBe("AP1");
    expect(result.targetType).toBe("LEAVE_REQUEST");
    expect(result.studentName).toBe("John Doe");
    expect(result.leaveTypeName).toBe("Internship");
    expect(result.leaveTypeDescription).toBe("Leave for internship-related travel");
    expect(result.leaveReason).toBe("Family visit");
    expect(result.parentName).toBe("Parent Name");
  });

  it("throws NotFoundError when token is invalid", async () => {
    mockFindByParentApprovalToken.mockResolvedValue(null);

    await expect(getLeaveDetailsByToken("bad-token")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when approval is expired", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      ...MOCK_APPROVAL_LEAVE,
      parentApprovalExpiresAt: new Date("2020-01-01"),
    });

    await expect(getLeaveDetailsByToken("expired-token")).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns empty leave type when the leave type cannot be resolved", async () => {
    mockFindLeaveTypeById.mockResolvedValue(null);

    const result = await getLeaveDetailsByToken("valid-token");

    expect(result.leaveTypeName).toBe("");
    expect(result.leaveTypeDescription).toBe("");
  });

  it("throws ConflictError when approval already processed", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      ...MOCK_APPROVAL_LEAVE,
      decision: "APPROVED",
    });

    await expect(getLeaveDetailsByToken("used-token")).rejects.toBeInstanceOf(ConflictError);
  });
});
