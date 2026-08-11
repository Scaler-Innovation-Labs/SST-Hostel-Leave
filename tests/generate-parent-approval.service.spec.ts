// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindPrimaryByStudentId = vi.fn();
const mockUpdateParentApprovalToken = vi.fn();
const mockAuditRecord = vi.fn();
const mockOutboxPublish = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findPrimaryByStudentId: (...args: any[]) => mockFindPrimaryByStudentId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    updateParentApprovalToken: (...args: any[]) => mockUpdateParentApprovalToken(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockOutboxPublish(...args),
  },
}));

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const { mockSha256, mockToHex } = vi.hoisted(() => ({
  mockSha256: vi.fn().mockResolvedValue("hashed-token"),
  mockToHex: vi.fn().mockReturnValue("hex-token"),
}));

vi.mock("@/lib/crypto", () => ({
  sha256: mockSha256,
  toHex: mockToHex,
}));

import { generateParentApproval } from "@/services/parent/generate-parent-approval.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

const VALID_CONTEXT = {
  leaveRequestId: "LR1",
  studentId: "S1",
  studentName: "John Doe",
  leaveDates: "10 Jun - 12 Jun",
  leaveReason: "Family visit",
  baseUrl: "https://example.com",
};

const APPROVAL_STEP = { id: "AP1", stepKey: "PARENT_APPROVAL" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindPrimaryByStudentId.mockResolvedValue({ id: "P1", phone: "+1234567890", name: "Parent" });
  mockUpdateParentApprovalToken.mockResolvedValue(undefined);
  mockAuditRecord.mockResolvedValue({});
  mockOutboxPublish.mockResolvedValue(undefined);
  mockSha256.mockResolvedValue("hashed-token");
  mockToHex.mockReturnValue("hex-token");
});

describe("generateParentApproval service", () => {
  it("generates parent approval with SMS notification", async () => {
    await generateParentApproval(VALID_CONTEXT, APPROVAL_STEP);

    expect(mockFindPrimaryByStudentId).toHaveBeenCalledWith("S1");
    expect(mockUpdateParentApprovalToken).toHaveBeenCalledWith("AP1", "hashed-token", expect.any(Date), expect.any(Object));
    expect(mockAuditRecord).toHaveBeenCalledWith("CREATE", "LEAVE_APPROVAL", "AP1", null, expect.any(Object), expect.any(Object));
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NOTIFICATION_REQUESTED",
        payload: expect.objectContaining({
          notificationType: "PARENT_APPROVAL_REQUESTED",
          recipientPhone: "+1234567890",
        }),
      }),
      expect.any(Object)
    );
  });

  it("throws NotFoundError when no primary parent found", async () => {
    mockFindPrimaryByStudentId.mockResolvedValue(null);

    await expect(generateParentApproval(VALID_CONTEXT, APPROVAL_STEP)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError when parent has no phone", async () => {
    mockFindPrimaryByStudentId.mockResolvedValue({ id: "P1", phone: null, name: "Parent" });

    await expect(generateParentApproval(VALID_CONTEXT, APPROVAL_STEP)).rejects.toBeInstanceOf(ValidationError);
  });

  it("generates correct approval link in notification", async () => {
    mockFindPrimaryByStudentId.mockResolvedValue({ id: "P1", phone: "+1234567890", name: "Parent" });

    await generateParentApproval(VALID_CONTEXT, APPROVAL_STEP);

    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          variables: expect.objectContaining({
            approvalLink: "https://example.com/parent-approve/hex-token",
            parentApprovalName: "John Doe",
          }),
        }),
      }),
      expect.any(Object)
    );
  });

  it("includes leaveExtensionId when provided", async () => {
    const context = { ...VALID_CONTEXT, leaveExtensionId: "EXT1" };

    await generateParentApproval(context, APPROVAL_STEP);

    expect(mockAuditRecord).toHaveBeenCalledWith("CREATE", "LEAVE_APPROVAL", "AP1", null,
      expect.objectContaining({ leaveExtensionId: "EXT1" }),
      expect.any(Object)
    );
  });
});
