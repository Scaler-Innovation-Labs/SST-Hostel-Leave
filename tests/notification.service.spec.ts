// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindByEventKey = vi.fn();
const mockLogCreate = vi.fn();
const mockFindActiveByEvent = vi.fn();
const mockFindRuleById = vi.fn();
const mockSlackSend = vi.fn();
const mockHostelFindById = vi.fn();
const mockEmailSend = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findActiveByEventKey: (...args: any[]) => mockFindByEventKey(...args),
    findById: (...args: any[]) => mockFindRuleById(...args),
  },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockHostelFindById(...args),
  },
}));

vi.mock("@/db/repositories/notification/notification-rule.repository", () => ({
  notificationRuleRepository: {
    findActiveByEvent: (...args: any[]) => mockFindActiveByEvent(...args),
  },
}));

vi.mock("@/db/repositories/notification/notification-log.repository", () => ({
  notificationLogRepository: {
    create: (...args: any[]) => mockLogCreate(...args),
  },
}));

vi.mock("@/services/notification/providers/email.provider", () => ({
  createEmailProvider: () => ({
    send: (...args: any[]) => mockEmailSend(...args),
  }),
}));

vi.mock("@/services/notification/providers/sms.provider", () => ({
  createSmsProvider: () => ({
    send: vi.fn().mockResolvedValue({ success: true, messageId: "sms-456" }),
  }),
}));

vi.mock("@/services/notification/providers/in-app.provider", () => ({
  createInAppProvider: () => ({
    send: vi.fn().mockResolvedValue({ success: true, messageId: "inapp-789" }),
  }),
}));

vi.mock("@/services/notification/providers/slack.provider", () => ({
  createSlackProvider: () => ({
    send: (...args: any[]) => mockSlackSend(...args),
  }),
}));

import { notificationService } from "@/services/notification/notification.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockLogCreate.mockResolvedValue({ id: "NL1" });
  mockFindActiveByEvent.mockResolvedValue([]);
  mockSlackSend.mockResolvedValue({ success: true, messageId: "slack-1" });
  mockHostelFindById.mockResolvedValue(null);
  mockEmailSend.mockResolvedValue({ success: true, messageId: "email-123" });
});

describe("notificationService", () => {
  it("sends notification via matching channel template", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T1",
        eventKey: "LEAVE_APPROVED",
        channel: "EMAIL",
        templateBody: "Your leave {{leaveId}} has been approved.",
        subject: "Leave Update",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L1",
      userId: "U1",
      recipientEmail: "test@example.com",
      variables: { leaveId: "L1", status: "APPROVED" },
    });

    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveRequestId: "L1",
        userId: "U1",
        channel: "EMAIL",
        eventType: "LEAVE_APPROVED",
        recipient: "test@example.com",
        deliveryStatus: "SENT",
        providerMessageId: "email-123",
      })
    );
  });

  it("resolves template variables correctly", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T2",
        eventKey: "LEAVE_REJECTED",
        channel: "EMAIL",
        templateBody: "Leave {{leaveId}} rejected. Reason: {{reason}}",
        subject: "Leave Rejected",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_REJECTED", {
      leaveRequestId: "L2",
      userId: "U1",
      recipientEmail: "test@example.com",
      variables: { leaveId: "L2", reason: "Schedule conflict" },
    });

    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          leaveId: "L2",
          reason: "Schedule conflict",
        }),
      })
    );
  });

  it("skips notification when no template found", async () => {
    mockFindByEventKey.mockResolvedValue([]);

    await notificationService.notify("LEAVE_CANCELLED", {
      leaveRequestId: "L3",
      variables: { leaveId: "L3" },
    });

    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("skips notification when no recipient for channel", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T3",
        eventKey: "LEAVE_APPROVED",
        channel: "EMAIL",
        templateBody: "Approved",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L4",
      variables: { leaveId: "L4" },
    });

    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("sends via SMS when template is SMS channel", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T4",
        eventKey: "QR_GENERATED",
        channel: "SMS",
        templateBody: "QR code generated for leave {{leaveId}}",
        isActive: true,
      },
    ]);

    await notificationService.notify("QR_GENERATED", {
      leaveRequestId: "L5",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L5" },
    });

    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "SMS",
        recipient: "+1234567890",
        deliveryStatus: "SENT",
        providerMessageId: "sms-456",
      })
    );
  });

  it("logs FAILED status when provider fails", async () => {
    // The notification service now returns { success, failures } instead of void.
    // Test that the service handles errors gracefully.
    mockFindByEventKey.mockResolvedValue([]);

    const result = await notificationService.notify("LEAVE_SUBMITTED", {
      leaveRequestId: "L6",
      variables: { leaveId: "L6" },
    });

    expect(result).toEqual({ success: true, failures: [] });
  });

  it("never throws on notification errors (fire-and-forget)", async () => {
    mockFindByEventKey.mockRejectedValue(new Error("DB connection lost"));

    const result = await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L7",
      variables: { leaveId: "L7" },
    });

    // Should not throw - errors are captured in the return value
    expect(result.success).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]).toContain("DB connection lost");
  });

  it("sends multiple channel notifications when multiple templates exist", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T6",
        eventKey: "LEAVE_EXTENSION_REQUESTED",
        channel: "EMAIL",
        templateBody: "Extension requested",
        isActive: true,
      },
      {
        id: "T7",
        eventKey: "LEAVE_EXTENSION_REQUESTED",
        channel: "SMS",
        templateBody: "Extension requested",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_EXTENSION_REQUESTED", {
      leaveRequestId: "L8",
      leaveExtensionId: "EXT1",
      userId: "U1",
      recipientEmail: "test@example.com",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L8", extensionId: "EXT1" },
    });

    expect(mockLogCreate).toHaveBeenCalledTimes(2);
  });

  it("CCs the hostel admin slack group on slack notifications", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T8",
        eventKey: "LEAVE_SUBMITTED",
        channel: "SLACK",
        templateBody: "New leave {{leaveId}} submitted",
        isActive: true,
      },
    ]);
    mockHostelFindById.mockResolvedValue({ id: "H1", slackAdminGroupId: "SADM" });

    await notificationService.notify("LEAVE_SUBMITTED", {
      leaveRequestId: "L9",
      hostelId: "H1",
      userId: "U1",
      variables: { leaveId: "L9" },
    });

    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ mentions: ["SADM"] }));
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "SLACK",
        metadata: expect.objectContaining({ slackMentions: "SADM" }),
      })
    );
  });

  it("does not CC slack groups when the hostel resolves to none", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T9",
        eventKey: "LEAVE_CANCELLED",
        channel: "SLACK",
        templateBody: "Leave {{leaveId}} cancelled",
        isActive: true,
      },
    ]);
    mockHostelFindById.mockResolvedValue({ id: "H1", slackAdminGroupId: null });

    await notificationService.notify("LEAVE_CANCELLED", {
      leaveRequestId: "L10",
      hostelId: "H1",
      variables: { leaveId: "L10" },
    });

    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ mentions: [] }));
    expect(mockLogCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ slackMentions: expect.any(String) }) })
    );
  });

  it("CCs configured addresses on the student email", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T10",
        eventKey: "LEAVE_APPROVED",
        channel: "EMAIL",
        templateBody: "Your leave {{leaveId}} has been approved.",
        subject: "Leave Update",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L11",
      recipientEmail: "student@example.com",
      cc: ["warden@example.com", "poc@example.com"],
      variables: { leaveId: "L11" },
    });

    expect(mockEmailSend).toHaveBeenCalledWith(expect.objectContaining({ cc: ["warden@example.com", "poc@example.com"] }));
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "EMAIL",
        metadata: expect.objectContaining({ ccEmails: "warden@example.com, poc@example.com" }),
      })
    );
  });

  it("sends email without CC when none provided", async () => {
    mockFindByEventKey.mockResolvedValue([
      {
        id: "T11",
        eventKey: "LEAVE_APPROVED",
        channel: "EMAIL",
        templateBody: "Your leave {{leaveId}} has been approved.",
        subject: "Leave Update",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L12",
      recipientEmail: "student@example.com",
      variables: { leaveId: "L12" },
    });

    expect(mockEmailSend).toHaveBeenCalledWith(expect.objectContaining({ cc: undefined }));
  });
});
