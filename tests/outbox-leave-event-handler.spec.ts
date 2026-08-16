// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNotify = vi.fn().mockResolvedValue({ success: true, failures: [] });

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: (...args: any[]) => mockNotify(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: vi.fn(),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: vi.fn(),
    findPrimaryByStudentId: vi.fn(),
  },
}));

const mockGenerateParentApproval = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/parent/generate-parent-approval.service", () => ({
  generateParentApproval: (...args: any[]) => mockGenerateParentApproval(...args),
}));

import { handleLeaveEvent } from "@/services/outbox/handlers/leave-event.handler";
import { generateParentApproval } from "@/services/parent/generate-parent-approval.service";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";

beforeEach(() => {
  vi.resetAllMocks();
  mockNotify.mockResolvedValue({ success: true, failures: [] });
  // Default: all repositories return null (no data resolved)
  (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (qrPassRepository.findByLeaveRequestId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

function makeEvent(eventType: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "OE1",
    eventType,
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "L1",
    payload: {
      leaveRequestId: "L1",
      userId: "U1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L1" },
      ...overrides,
    },
    status: "PENDING",
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    processedAt: null,
  };
}

describe("handleLeaveEvent", () => {
  it("maps LEAVE_CREATED to LEAVE_SUBMITTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_CREATED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_SUBMITTED", expect.any(Object));
  });

  it("maps LEAVE_APPROVED to LEAVE_APPROVED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_APPROVED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVED", expect.any(Object));
  });

  it("maps LEAVE_REJECTED to LEAVE_REJECTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_REJECTED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_REJECTED", expect.any(Object));
  });

  it("maps LEAVE_CANCELLED to LEAVE_CANCELLED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_CANCELLED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_CANCELLED", expect.any(Object));
  });

  it("maps LEAVE_COMPLETED to LEAVE_COMPLETED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_COMPLETED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_COMPLETED", expect.any(Object));
  });

  it("maps LEAVE_EXPIRED to LEAVE_EXPIRED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_EXPIRED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_EXPIRED", expect.any(Object));
  });

  it("maps LEAVE_EXTENDED to LEAVE_EXTENSION_REQUESTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_EXTENDED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_EXTENSION_REQUESTED", expect.any(Object));
  });

  it("maps LEAVE_APPROVAL_REQUIRED to LEAVE_APPROVAL_REQUIRED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_APPROVAL_REQUIRED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVAL_REQUIRED", expect.any(Object));
  });

  it("dispatches LEAVE_POC_REVIEW_REQUIRED when the new current step is a POC step", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
      hostelId: "H1",
    });

    await handleLeaveEvent(makeEvent("LEAVE_APPROVAL_REQUIRED", { stepKey: "POC_APPROVAL", stepOrder: 2 }));

    expect(mockNotify).toHaveBeenCalledWith(
      "LEAVE_POC_REVIEW_REQUIRED",
      expect.objectContaining({
        hostelId: "H1",
        variables: expect.objectContaining({
          approvalLink: expect.stringContaining("/poc/approvals/L1"),
        }),
      })
    );
    expect(mockNotify).not.toHaveBeenCalledWith("LEAVE_APPROVAL_REQUIRED", expect.anything());
  });

  it("dispatches LEAVE_APPROVAL_REQUIRED when the new current step is an ADMIN step", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
      hostelId: "H1",
    });

    await handleLeaveEvent(makeEvent("LEAVE_APPROVAL_REQUIRED", { stepKey: "ADMIN_APPROVAL", stepOrder: 3 }));

    expect(mockNotify).toHaveBeenCalledWith(
      "LEAVE_APPROVAL_REQUIRED",
      expect.objectContaining({
        variables: expect.objectContaining({
          approvalLink: expect.stringContaining("/admin/approvals/L1"),
        }),
      })
    );
  });

  it("populates a POC review link for LEAVE_SUBMITTED (late-stay POC template)", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
      hostelId: "H1",
    });

    await handleLeaveEvent(makeEvent("LEAVE_CREATED"));

    const context = mockNotify.mock.calls.find(([type]) => type === "LEAVE_SUBMITTED")?.[1];
    expect(context).toBeDefined();
    expect(context.variables.approvalLink).toContain("/poc/approvals/L1");
  });

  it("populates the admin approval link for LEAVE_APPROVAL_REQUIRED", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
      hostelId: "H1",
    });

    await handleLeaveEvent(makeEvent("LEAVE_APPROVAL_REQUIRED"));

    expect(mockNotify).toHaveBeenCalledWith(
      "LEAVE_APPROVAL_REQUIRED",
      expect.objectContaining({
        hostelId: "H1",
        variables: expect.objectContaining({
          approvalLink: expect.stringContaining("/admin/approvals/L1"),
        }),
      })
    );
  });

  it("handles PARENT_APPROVAL_REQUIRED without dispatching notification directly (uses outbox instead)", async () => {
    await handleLeaveEvent(makeEvent("PARENT_APPROVAL_REQUIRED"));

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rethrows transient parent-approval failures so the outbox retries", async () => {
    const event = makeEvent("PARENT_APPROVAL_REQUIRED", {
      studentId: "S1",
      studentName: "Neerasa",
      leaveDates: "10 Jun - 12 Jun",
      leaveReason: "Home",
      baseUrl: "https://example.com",
      approvalStepId: "AP1",
      approvalStepKey: "PARENT_APPROVAL",
    });
    mockGenerateParentApproval.mockRejectedValueOnce(
      new Error("database connection lost")
    );

    await expect(handleLeaveEvent(event)).rejects.toThrow("database connection lost");
  });

  it("swallows permanent parent-approval failures (no parent / no phone)", async () => {
    const event = makeEvent("PARENT_APPROVAL_REQUIRED", {
      studentId: "S1",
      studentName: "Neerasa",
      leaveDates: "10 Jun - 12 Jun",
      leaveReason: "Home",
      baseUrl: "https://example.com",
      approvalStepId: "AP1",
      approvalStepKey: "PARENT_APPROVAL",
    });
    mockGenerateParentApproval.mockRejectedValueOnce(
      new (await import("@/lib/errors")).NotFoundError("Parent")
    );

    await expect(handleLeaveEvent(event)).resolves.toBeUndefined();
  });

  it("passes payload fields to notification context", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2025-06-01"),
      endAt: new Date("2025-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
    });

    await handleLeaveEvent(makeEvent("LEAVE_CREATED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_SUBMITTED", expect.objectContaining({
      leaveRequestId: "L1",
      userId: "U1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: expect.objectContaining({ leaveId: "L1" }),
    }));
  });

  it("passes payload ccEmails into the notification context", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_APPROVED", { ccEmails: ["warden@example.com", "poc@example.com"] }));

    expect(mockNotify).toHaveBeenCalledWith(
      "LEAVE_APPROVED",
      expect.objectContaining({ cc: ["warden@example.com", "poc@example.com"] })
    );
  });

  it("omits cc from the notification context when payload has no ccEmails", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_APPROVED"));

    const context = mockNotify.mock.calls.find(([type]) => type === "LEAVE_APPROVED")?.[1];
    expect(context.cc).toBeUndefined();
  });

  it("points the approval email QR at the hosted image route (never a data URI)", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
      hostelId: "H1",
    });
    (qrPassRepository.findByLeaveRequestId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "QP1",
      token: "raw-token-must-stay-server-side",
    });

    await handleLeaveEvent(makeEvent("LEAVE_APPROVED"));

    const context = mockNotify.mock.calls.find(([type]) => type === "LEAVE_APPROVED")?.[1];
    expect(context.variables.qrCodeUrl).toContain("/api/v1/qr/QP1/image");
    expect(context.variables.qrCodeUrl).not.toContain("data:image");
    expect(context.variables.qrCodeUrl).not.toContain("raw-token");
  });

  it("does not throw for unmapped event types", async () => {
    const event = makeEvent("UNMAPPED_EVENT");

    await expect(handleLeaveEvent(event)).resolves.toBeUndefined();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rethrows when notification delivery fails so the outbox retries", async () => {
    mockNotify.mockResolvedValue({
      success: false,
      failures: ["Provider reported delivery failure: 500"],
    });

    await expect(handleLeaveEvent(makeEvent("LEAVE_CREATED"))).rejects.toThrow(
      /Notification delivery failed/
    );
  });
});
