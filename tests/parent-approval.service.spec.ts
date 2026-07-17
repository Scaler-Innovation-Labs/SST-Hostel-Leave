// @ts-nocheck
import crypto from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

import { outboxService } from "@/services/outbox/outbox.service";

const mockFindByParentApprovalToken = vi.fn();
const mockUpdateParentApprovalOtp = vi.fn().mockResolvedValue({ id: "LA1" });
const mockUpdateParentApprovalToken = vi.fn().mockResolvedValue({ id: "LA1" });
const mockUpdateParentApprovalVerified = vi.fn().mockResolvedValue({ id: "LA1" });
const mockUpdateParentDecision = vi.fn().mockResolvedValue({ id: "LA1" });
const mockFindNextByDecision = vi.fn().mockResolvedValue(null);
const mockFindNextByDecisionForExtension = vi.fn().mockResolvedValue(null);
const mockParentFindById = vi.fn();
const mockParentFindPrimaryByStudentId = vi.fn();
const mockLeaveFindById = vi.fn();
const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockOutboxPublish = vi.fn().mockResolvedValue(undefined);
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockLeaveUpdateById = vi.fn().mockResolvedValue({ id: "LR1" });
const mockLeaveUpdateCurrentStep = vi.fn().mockResolvedValue({ id: "LR1" });
const mockExtensionUpdateById = vi.fn().mockResolvedValue({ id: "EXT1" });
const mockExtensionUpdateCurrentStep = vi.fn().mockResolvedValue({ id: "EXT1" });
const mockExtensionFindByIdWithLeave = vi.fn();

vi.mock("@/lib/db", () => {
  const tx: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByParentApprovalToken: (...args: any[]) => mockFindByParentApprovalToken(...args),
    updateParentApprovalOtp: (...args: any[]) => mockUpdateParentApprovalOtp(...args),
    updateParentApprovalToken: (...args: any[]) => mockUpdateParentApprovalToken(...args),
    updateParentApprovalVerified: (...args: any[]) => mockUpdateParentApprovalVerified(...args),
    updateParentDecision: (...args: any[]) => mockUpdateParentDecision(...args),
    findNextByDecision: (...args: any[]) => mockFindNextByDecision(...args),
    findNextByDecisionForExtension: (...args: any[]) => mockFindNextByDecisionForExtension(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    updateById: (...args: any[]) => mockExtensionUpdateById(...args),
    updateCurrentStep: (...args: any[]) => mockExtensionUpdateCurrentStep(...args),
    findByIdWithLeave: (...args: any[]) => mockExtensionFindByIdWithLeave(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
    findPrimaryByStudentId: (...args: any[]) => mockParentFindPrimaryByStudentId(...args),
  },
}));

const mockOtpSendOtp = vi.fn().mockResolvedValue({ success: true, reqId: "REQ123" })
const mockOtpVerifyOtp = vi.fn().mockResolvedValue({ success: true, identifier: "9492079771" })
const mockSmsSend = vi.fn().mockResolvedValue({ success: true, messageId: "MSG123" })

vi.mock("@/lib/messaging", () => ({
  createSmsProvider: () => ({ send: mockSmsSend }),
  createOtpProvider: () => ({
    sendOtp: mockOtpSendOtp,
    verifyOtp: mockOtpVerifyOtp,
    resendOtp: vi.fn(),
  }),
  createEmailProvider: () => ({ send: vi.fn() }),
  getConfig: () => ({
    sms: { provider: "msg91", msg91: { authKey: "test", senderId: "TEST", flowIds: {} } },
    email: { provider: "ses" },
    otp: { provider: "msg91-widget" },
    defaults: { testMode: false },
  }),
}))

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
    findById: (...args: any[]) => mockLeaveFindById(...args),
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
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
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
    expect(mockOtpSendOtp).toHaveBeenCalled();
    expect(outboxService.publish).toHaveBeenCalledTimes(1);
  });

  it("rejects OTP for wrong phone", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
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

  it("sends OTP for extension approval", async () => {
    const currentEnd = new Date("2026-06-15");
    const requestedEnd = new Date("2026-06-20");

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: "EXT1",
      leaveExtension: {
        id: "EXT1",
        extensionNumber: 2,
        reason: "Need more time for exams",
        currentEndAt: currentEnd,
        requestedEndAt: requestedEnd,
        status: "PENDING",
        submittedForm: null,
        leaveRequestId: "LR1",
      },
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      studentName: "Test Student",
      studentRollNumber: "24BCS10005",
    });
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    const result = await sendParentOtp(RAW_TOKEN, "9492079771");

    expect(result.phoneLast4).toBe("9771");
    expect(mockOtpSendOtp).toHaveBeenCalled();
    expect(outboxService.publish).toHaveBeenCalledTimes(1);
    // Verify the outbox payload includes leaveExtensionId
    const publishCall = outboxService.publish.mock.calls[0][0];
    expect(publishCall.payload.leaveExtensionId).toBe("EXT1");
  });
});

describe("verifyParentOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies correct OTP", async () => {
    const otp = "123456";

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
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
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    const result = await verifyParentOtp(RAW_TOKEN, otp);

    expect(result.approvalId).toBe("LA1");
    expect(result.studentName).toBe("Test Student");
    expect(result.submittedForm).toEqual({ destination: "Vizag" });
    expect(mockUpdateParentApprovalVerified).toHaveBeenCalledWith("LA1");
  });

  it("rejects wrong OTP", async () => {
    mockOtpVerifyOtp.mockResolvedValueOnce({ success: false, error: "Invalid OTP" })

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: { id: "LR1", reason: "r", startAt: new Date(), endAt: new Date(), status: "PENDING", submittedForm: null },
    });
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
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

  it("verifies correct OTP for extension", async () => {
    const otp = "654321";
    const currentEnd = new Date("2026-06-15");
    const requestedEnd = new Date("2026-06-22");

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: "EXT1",
      leaveExtension: {
        id: "EXT1",
        extensionNumber: 2,
        reason: "Need more time for exams",
        currentEndAt: currentEnd,
        requestedEndAt: requestedEnd,
        status: "PENDING",
        submittedForm: { reason: "exams" },
        leaveRequestId: "LR1",
      },
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: null,
      decision: "PENDING",
      studentName: "Test Student",
      studentRollNumber: "24BCS10005",
      leaveRequest: null,
    });
    mockParentFindById.mockResolvedValue({
      id: "P1",
      phone: "9492079771",
    });

    const result = await verifyParentOtp(RAW_TOKEN, otp);

    expect(result.approvalId).toBe("LA1");
    expect(result.targetType).toBe("LEAVE_EXTENSION");
    expect(result.leaveExtensionId).toBe("EXT1");
    expect(result.extensionNumber).toBe(2);
    expect(result.leaveReason).toBe("Need more time for exams");
    expect(result.leaveStartDate).toEqual(currentEnd);
    expect(result.leaveEndDate).toEqual(requestedEnd);
    expect(result.submittedForm).toEqual({ reason: "exams" });
    expect(mockUpdateParentApprovalVerified).toHaveBeenCalledWith("LA1");
  });
});

describe("parentApproveDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves leave via parent decision", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
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
      leaveRequestId: "LR1",
      leaveExtensionId: null,
      leaveExtension: null,
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
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

  it("approves extension via parent decision", async () => {
    const currentEnd = new Date("2026-06-15");
    const requestedEnd = new Date("2026-06-22");

    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: "EXT1",
      leaveExtension: {
        id: "EXT1",
        extensionNumber: 2,
        reason: "Need more time",
        currentEndAt: currentEnd,
        requestedEndAt: requestedEnd,
        status: "PENDING",
        submittedForm: null,
        leaveRequestId: "LR1",
      },
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: null,
    });
    mockUpdateParentDecision.mockResolvedValue({ id: "LA1", decision: "APPROVED" });
    mockFindNextByDecisionForExtension.mockResolvedValue(null);
    mockExtensionFindByIdWithLeave.mockResolvedValue({
      id: "EXT1",
      currentEndAt: currentEnd,
      requestedEndAt: requestedEnd,
      leaveRequest: { id: "LR1", studentId: "S1" },
    });

    const result = await parentApproveDecision(RAW_TOKEN, {
      decision: "APPROVED",
    });

    expect(result.decision).toBe("APPROVED");
    // Extension should be updated to APPROVED
    expect(mockExtensionUpdateById).toHaveBeenCalledWith(
      "EXT1",
      expect.objectContaining({ status: "APPROVED" }),
      expect.anything()
    );
    // Leave endAt should be updated to extension's requestedEndAt
    expect(mockLeaveUpdateById).toHaveBeenCalledWith(
      "LR1",
      expect.objectContaining({ endAt: requestedEnd }),
      expect.anything()
    );
    // Extension approved outbox event should be published
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEAVE_EXTENSION_APPROVED",
        aggregateId: "EXT1",
        payload: expect.objectContaining({
          extensionId: "EXT1",
          studentId: "S1",
        }),
      }),
      expect.anything()
    );
    expect(mockAuditRecord).toHaveBeenCalled();
  });

  it("rejects extension via parent decision", async () => {
    mockFindByParentApprovalToken.mockResolvedValue({
      id: "LA1",
      leaveRequestId: "LR1",
      leaveExtensionId: "EXT1",
      leaveExtension: {
        id: "EXT1",
        extensionNumber: 2,
        reason: "Need more time",
        currentEndAt: new Date("2026-06-15"),
        requestedEndAt: new Date("2026-06-22"),
        status: "PENDING",
        submittedForm: null,
        leaveRequestId: "LR1",
      },
      approverParentId: "P1",
      parentApprovalExpiresAt: new Date(Date.now() + 3600000),
      parentApprovalVerifiedAt: new Date(),
      decision: "PENDING",
      parentApprovalToken: TOKEN_HASH,
      stepOrder: 1,
      studentName: "Test",
      studentRollNumber: "001",
      leaveRequest: null,
    });
    mockUpdateParentDecision.mockResolvedValue({ id: "LA1", decision: "REJECTED" });

    const result = await parentApproveDecision(RAW_TOKEN, {
      decision: "REJECTED",
      comments: "Not necessary",
    });

    expect(result.decision).toBe("REJECTED");
    // Extension should be updated to REJECTED
    expect(mockExtensionUpdateById).toHaveBeenCalledWith(
      "EXT1",
      expect.objectContaining({ status: "REJECTED" }),
      expect.anything()
    );
    // Extension rejected outbox event should be published
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEAVE_EXTENSION_REJECTED",
        aggregateId: "EXT1",
        payload: expect.objectContaining({
          extensionId: "EXT1",
          reason: "Not necessary",
        }),
      }),
      expect.anything()
    );
    expect(mockAuditRecord).toHaveBeenCalled();
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

    expect(mockUpdateParentApprovalToken).toHaveBeenCalledWith(
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
