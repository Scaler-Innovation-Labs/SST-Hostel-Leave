import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogCreate = vi.fn();
const mockHasSentForOutboxChannel = vi.fn();
const mockHasSentForOutboxEventId = vi.fn();

vi.mock("@/db/repositories/notification/notification-log.repository", () => ({
  notificationLogRepository: {
    create: (...args: any[]) => mockLogCreate(...args),
    hasSentForOutboxChannel: (...args: any[]) => mockHasSentForOutboxChannel(...args),
    hasSentForOutboxEventId: (...args: any[]) => mockHasSentForOutboxEventId(...args),
  },
}));

const mockFindActiveByEvent = vi.fn();
vi.mock("@/db/repositories/notification/notification-rule.repository", () => ({
  notificationRuleRepository: {
    findActiveByEvent: (...args: any[]) => mockFindActiveByEvent(...args),
  },
}));

const mockFindByIds = vi.fn();
const mockFindByCode = vi.fn();
vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findByIds: (...args: any[]) => mockFindByIds(...args),
    findByCode: (...args: any[]) => mockFindByCode(...args),
  },
}));

const mockEmailSend = vi.fn();
vi.mock("@/services/notification/providers/email.provider", () => ({
  createEmailProvider: () => ({
    send: (...args: any[]) => mockEmailSend(...args),
  }),
}));

const mockSlackSend = vi.fn();
vi.mock("@/services/notification/providers/slack.provider", () => ({
  createSlackProvider: () => ({
    send: (...args: any[]) => mockSlackSend(...args),
  }),
}));

const mockSmsSend = vi.fn();
vi.mock("@/services/notification/providers/sms.provider", () => ({
  createSmsProvider: () => ({
    send: (...args: any[]) => mockSmsSend(...args),
  }),
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: vi.fn().mockResolvedValue({ id: "S1", userId: "U1" }),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({ id: "U1", fullName: "Test Student", email: "student@sst.edu", phone: "+919999999999" }),
    findByIds: vi.fn().mockResolvedValue([
      { id: "U1", fullName: "Test Student", email: "student@sst.edu", phone: "+919999999999" },
    ]),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findPrimaryByStudentId: vi.fn().mockResolvedValue({ id: "P1", name: "Test Parent", email: "parent@example.com", phone: "+918888888888" }),
    findById: vi.fn().mockResolvedValue({ id: "P1", name: "Test Parent", email: "parent@example.com", phone: "+918888888888" }),
  },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: vi.fn().mockResolvedValue({ id: "H1", name: "Hostel A", slackChannelId: "C_HOSTEL_A", slackAdminGroupId: "S_ADMIN" }),
  },
}));

import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { notificationService } from "@/services/notification/notification.service";

describe("B12 — Notification Idempotency and Partial Failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasSentForOutboxChannel.mockResolvedValue(false);
    mockHasSentForOutboxEventId.mockResolvedValue(false);
    mockEmailSend.mockResolvedValue({ success: true, messageId: "email-msg-1" });
    mockSlackSend.mockResolvedValue({ success: true, messageId: "slack-msg-1" });
    mockSmsSend.mockResolvedValue({ success: true, messageId: "sms-msg-1" });
    mockLogCreate.mockResolvedValue({ id: "log-1" });

    // Default matching rule: Email and Slack channels
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R1",
        templateId: "T1",
        channels: [{ channel: "EMAIL" }, { channel: "SLACK" }],
        recipients: [{ recipientType: "STUDENT" }],
      },
    ]);

    mockFindByIds.mockResolvedValue([
      {
        id: "T1",
        code: "LEAVE_APPROVED_TMPL",
        channel: "EMAIL",
        templateBody: "Your leave has been approved",
        subject: "Leave Approved",
      },
    ]);
  });

  it("delivers both Email and Slack on normal first attempt", async () => {
    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-100",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    expect(res.success).toBe(true);
    expect(res.failures).toHaveLength(0);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(mockSlackSend).toHaveBeenCalledTimes(1);
    expect(mockLogCreate).toHaveBeenCalledTimes(2);
  });

  it("handles partial channel failure: Email succeeds, Slack fails", async () => {
    mockSlackSend.mockResolvedValueOnce({ success: false, error: "Slack rate limited" });

    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-101",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    expect(res.success).toBe(false);
    expect(res.failures).toHaveLength(1);
    expect(res.failures[0]).toContain("Slack rate limited");
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(mockSlackSend).toHaveBeenCalledTimes(1);
    expect(mockLogCreate).toHaveBeenCalledTimes(2); // One SENT for email, one FAILED for slack
  });

  it("on retry after partial failure: skips successful Email and only retries Slack", async () => {
    // Simulate that Email was already sent for OE-101
    mockHasSentForOutboxChannel.mockImplementation(async (outboxEventId, channel) => {
      if (outboxEventId === "OE-101" && channel === "EMAIL") return true;
      return false;
    });

    // Slack succeeds on retry
    mockSlackSend.mockResolvedValueOnce({ success: true, messageId: "slack-msg-retry" });

    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-101",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    expect(res.success).toBe(true);
    expect(res.failures).toHaveLength(0);
    // Email was skipped:
    expect(mockEmailSend).not.toHaveBeenCalled();
    // Slack was retried and succeeded:
    expect(mockSlackSend).toHaveBeenCalledTimes(1);
    expect(mockLogCreate).toHaveBeenCalledTimes(1); // Only for Slack
  });

  it("skips all channels if entire outbox event was already delivered", async () => {
    mockHasSentForOutboxChannel.mockResolvedValue(true);

    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-102",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    expect(res.success).toBe(true);
    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(mockSlackSend).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("handles concurrent race: unique constraint error on log creation prevents duplicate delivery tracking", async () => {
    // Suppose Worker B racing Worker A both pass the initial check,
    // but Worker A inserts first; Worker B hits the unique constraint on notification_logs.
    const uniqueConstraintError: any = new Error("duplicate key value violates unique constraint notification_logs_outbox_delivery_sent_unq");
    uniqueConstraintError.code = "23505";
    mockLogCreate.mockRejectedValueOnce(uniqueConstraintError);

    // Only email configured
    mockFindActiveByEvent.mockResolvedValueOnce([
      {
        id: "R1",
        templateId: "T1",
        channels: [{ channel: "EMAIL" }],
        recipients: [{ recipientType: "STUDENT" }],
      },
    ]);

    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-RACE-1",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    // Does not fail the entire job, logs warning and safely exits
    expect(res.success).toBe(true);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it("handles multiple recipients independently for per-recipient channels", async () => {
    // Configure SMS rule with STUDENT and PARENT
    mockFindActiveByEvent.mockResolvedValueOnce([
      {
        id: "R2",
        templateId: "T2",
        channels: [{ channel: "SMS" }],
        recipients: [{ recipientType: "STUDENT" }, { recipientType: "PARENT" }],
      },
    ]);
    mockFindByIds.mockResolvedValueOnce([
      { id: "T2", code: "SMS_TMPL", channel: "SMS", templateBody: "SMS alert" },
    ]);

    // Student SMS already sent, Parent SMS not sent yet
    mockHasSentForOutboxChannel.mockImplementation(async (outboxEventId, channel, recipient) => {
      if (recipient === "+919999999999") return true;
      return false;
    });

    const res = await notificationService.notify(NOTIFICATION_EVENT.LEAVE_APPROVED, {
      outboxEventId: "OE-MULTI-1",
      leaveRequestId: "LR-1",
      studentId: "S1",
      variables: {},
    });

    expect(res.success).toBe(true);
    // Only Parent phone received SMS
    expect(mockSmsSend).toHaveBeenCalledTimes(1);
    expect(mockSmsSend).toHaveBeenCalledWith(expect.objectContaining({ to: "+918888888888" }));
  });
});
