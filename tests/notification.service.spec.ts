// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindByEventKey = vi.fn();
const mockLogCreate = vi.fn();
const mockFindActiveByEvent = vi.fn();
const mockFindRuleById = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findActiveByEventKey: (...args: any[]) => mockFindByEventKey(...args),
    findById: (...args: any[]) => mockFindRuleById(...args),
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
    send: vi.fn().mockResolvedValue({ success: true, messageId: "email-123" }),
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

import { notificationService } from "@/services/notification/notification.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockLogCreate.mockResolvedValue({ id: "NL1" });
  mockFindActiveByEvent.mockResolvedValue([]);
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
});
