// @ts-nocheck
import crypto from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

import { outboxService } from "@/services/outbox/outbox.service";

const mockFindByParentApprovalToken = vi.fn();
const mockUpdateParentApprovalOtp = vi.fn().mockResolvedValue({ id: "LA1" });
const mockUpdateParentApprovalVerified = vi.fn().mockResolvedValue({ id: "LA1" });
const mockUpdateParentDecision = vi.fn().mockResolvedValue({ id: "LA1" });
const mockFindNextByDecision = vi.fn().mockResolvedValue(null);
const mockParentFindById = vi.fn();
const mockParentFindPrimaryByStudentId = vi.fn();
const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockOutboxPublish = vi.fn().mockResolvedValue(undefined);
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockLeaveUpdateById = vi.fn().mockResolvedValue({ id: "LR1" });
const mockLeaveUpdateCurrentStep = vi.fn().mockResolvedValue({ id: "LR1" });

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (cb: any) => cb({}),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByParentApprovalToken: (...args: any[]) => mockFindByParentApprovalToken(...args),
    updateParentApprovalOtp: (...args: any[]) => mockUpdateParentApprovalOtp(...args),
    updateParentApprovalVerified: (...args: any[]) => mockUpdateParentApprovalVerified(...args),
    updateParentDecision: (...args: any[]) => mockUpdateParentDecision(...args),
    findNextByDecision: (...args: any[]) => mockFindNextByDecision(...args),
  },
}));

vi.mock("@/db/repositories/hostel/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
    findPrimaryByStudentId: (...args: any[]) => mockParentFindPrimaryByStudentId(...args),
  },
}));

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: (...args: any[]) => mockNotify(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockLeaveUpdateCurrentStep(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => {
  const mock = vi.fn().mockResolvedValue(undefined);
  return {
    outboxService: {
      publish: mock,
      publishMany: vi.fn().mockResolvedValue(undefined),
    },
    __mockOutboxPublish: mock,
  };
});

import { sendParentOtp } from "@/services/parent/send-parent-otp.service";
import { verifyParentOtp } from "@/services/parent/verify-parent-otp.service";
import { parentApproveDecision } from "@/services/parent/parent-approve-decision.service";
import { generateParentApproval } from "@/services/parent/generate-parent-approval.service";

const RAW_TOKEN = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const TOKEN_HASH = sha256(RAW_TOKEN);

describe("sendParentOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends OTP on matching phone", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
    });
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    const result = await sendParentOtp(RAW_TOKEN, "9492079771");

    expect(result.phoneLast4).toBe("9771");
    expect(mockUpdateParentApprovalOtp).toHaveBeenCalled();
    expect(outboxService.publish).toHaveBeenCalledTimes(1);
  });

  it("rejects OTP for wrong phone", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
    });
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    await expect(
      sendParentOtp(RAW_TOKEN, "0000000000")
    ).rejects.toThrow("Phone number does not match");
  });

  it("rejects expired token", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() - 1000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
    });

    await expect(
      sendParentOtp(RAW_TOKEN, "9492079771")
    ).rejects.toThrow("expired");
  });
});

describe("verifyParentOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies correct OTP", async () => {
    const otp = "123456";
    const otpHash = sha256(otp);

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      parentApprovalOtpHash: otpHash,
      studentName: "Test Student",
      studentRollNumber: "24BCS10005",
      leaveRequest: {
        id: "LR1",
        reason: "Family function",
        startAt: new Date("2026-06-15"),
        endAt: new Date("2026-06-20"),
        status: "PENDING",
        submittedForm: { destination: "Vizag" },
      },
    });

    const result = await verifyParentOtp(RAW_TOKEN, otp);

    expect(result.approvalId).toBe("LA1");
    expect(result.studentName).toBe("Test Student");
    expect(result.submittedForm).toEqual({ destination: "Vizag" });
    expect(mockUpdateParentApprovalVerified).toHaveBeenCalledWith("LA1");
  });

  it("rejects wrong OTP", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      parentApprovalOtpHash: sha256("123456"),
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: { id: "LR1", reason: "r", startAt: new Date(), endAt: new Date(), status: "PENDING", submittedForm: null },
    });

    await expect(verifyParentOtp(RAW_TOKEN, "999999")).rejects.toThrow("Invalid OTP");
  });

  it("rejects already verified", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
    });

    await expect(verifyParentOtp(RAW_TOKEN, "123456")).rejects.toThrow("already verified");
  });
});

describe("parentApproveDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves leave via parent decision", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
      leaveRequestId: "LR1",
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: { id: "LR1", reason: "r", startAt: new Date(), endAt: new Date(), status: "PENDING", submittedForm: null },
    });
    mockUpdateParentDecision.mockResolvedValue({ id: "LA1", decision: "APPROVED" });
    mockFindNextByDecision.mockResolvedValue(null);

    const result = await parentApproveDecision(RAW_TOKEN, {
      decision: "APPROVED",
    });

    expect(result.decision).toBe("APPROVED");
    expect(mockLeaveUpdateById).toHaveBeenCalledWith(
      "LR1",
      expect.objectContaining({ status: "APPROVED" }),
      expect.anything()
    );
    expect(mockAuditRecord).toHaveBeenCalled();
  });

  it("rejects leave via parent decision", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
      leaveRequestId: "LR1",
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: { id: "LR1", reason: "r", startAt: new Date(), endAt: new Date(), status: "PENDING", submittedForm: null },
    });
    mockUpdateParentDecision.mockResolvedValue({ id: "LA1", decision: "REJECTED" });

    const result = await parentApproveDecision(RAW_TOKEN, {
      decision: "REJECTED",
      comments: "Not appropriate",
    });

    expect(result.decision).toBe("REJECTED");
    expect(mockLeaveUpdateById).toHaveBeenCalledWith(
      "LR1",
      expect.objectContaining({ status: "REJECTED" }),
      expect.anything()
    );
  });

  it("rejects unverified OTP", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
    });

    await expect(
      parentApproveDecision(RAW_TOKEN, { decision: "APPROVED" })
    ).rejects.toThrow("OTP not verified");
  });

  it("rejects expired token", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() - 1000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
    });

    await expect(
      parentApproveDecision(RAW_TOKEN, { decision: "APPROVED" })
    ).rejects.toThrow();
  });
});

describe("generateParentApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates token and sends SMS", async () => {
    mockParentFindPrimaryByStudentId.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    await generateParentApproval(
      {
        leaveRequestId: "LR1",
        studentId: "S1",
        studentName: "Test Student",
        leaveDates: "6/15/2026 - 6/20/2026",
        leaveReason: "Family function",
        baseUrl: "http://localhost:3000",
      },
      { id: "LA1", stepKey: "parent" }
    );

    expect(mockUpdateParentApprovalOtp).toHaveBeenCalledWith(
      "LA1",
      expect.any(String),
      expect.any(Date),
      expect.anything()
    );
    expect(outboxService.publish).toHaveBeenCalledTimes(1);
  });

  it("throws when no parent found", async () => {
    mockParentFindPrimaryByStudentId.mockResolvedValue(null);

    await expect(
      generateParentApproval(
        {
          leaveRequestId: "LR1",
          studentId: "S1",
          studentName: "Test",
          leaveDates: "6/15 - 6/20",
          leaveReason: "reason",
          baseUrl: "http://localhost:3000",
        },
        { id: "LA1", stepKey: "parent" }
      )
    ).rejects.toThrow("Parent");
  });
});
