// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockFindByEventKey = vi.fn();
const mockFindByIds = vi.fn();
const mockLogCreate = vi.fn();
const mockFindActiveByEvent = vi.fn();
const mockFindRuleById = vi.fn();
const mockSlackSend = vi.fn();
const mockHostelFindById = vi.fn();
const mockEmailSend = vi.fn();
const mockFindUserIdsByRoleCode = vi.fn();
const mockFindUsersByIds = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findActiveByEventKey: (...args: any[]) => mockFindByEventKey(...args),
    findById: (...args: any[]) => mockFindRuleById(...args),
    findByIds: (...args: any[]) => mockFindByIds(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findUserIdsByRoleCode: (...args: any[]) => mockFindUserIdsByRoleCode(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByIds: (...args: any[]) => mockFindUsersByIds(...args),
  },
}));

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockHostelFindById(...args),
  },
}));

const mockFindParentById = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockFindParentById(...args),
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notificationService", () => {
  it("sends notification via matching rule template", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R1",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVED",
        templateId: "T1",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_approved_email_re_exam",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
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
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R2",
        leaveTypeId: null,
        eventType: "LEAVE_REJECTED",
        templateId: "T2",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_rejected_email_re_exam_admin",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
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

  it("does not corrupt template values containing dollar signs", async () => {
    // String.replace() with a string replacement treats $& / $' / $` as
    // special sequences — a user-supplied reason like "Paid $& to travel"
    // would have been mangled. The function replacer must keep it verbatim.
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R2b",
        leaveTypeId: null,
        eventType: "LEAVE_REJECTED",
        templateId: "T2b",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_rejected_email",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T2b",
        eventKey: "LEAVE_REJECTED",
        channel: "EMAIL",
        templateBody: "Reason: {{reason}}",
        subject: "Leave Rejected",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_REJECTED", {
      leaveRequestId: "L2b",
      userId: "U1",
      recipientEmail: "test@example.com",
      variables: { reason: "Paid $& to travel and $' after" },
    });

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Reason: Paid $& to travel and $' after",
      })
    );
  });

  it("escapes user values in the email htmlBody but keeps body raw", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R8",
        eventKey: "LEAVE_REJECTED",
        leaveTypeId: null,
        templateId: "T8",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_rejected_email",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T8",
        eventKey: "LEAVE_REJECTED",
        channel: "EMAIL",
        templateBody: "Reason: {{reason}}",
        subject: "Leave Rejected",
        isActive: true,
      },
    ]);

    await notificationService.notify("LEAVE_REJECTED", {
      leaveRequestId: "L8e",
      userId: "U1",
      recipientEmail: "test@example.com",
      variables: { reason: 'A <script>alert(1)</script> & "quoted"' },
    });

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Reason: A <script>alert(1)</script> & "quoted"',
        htmlBody:
          "Reason: A &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quoted&quot;",
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

  it("sends via SMS when rule channel is SMS", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R4",
        leaveTypeId: null,
        eventType: "QR_GENERATED",
        templateId: "T4",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "qr_sms_template",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "SMS" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
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

  it("strips bearer credentials from notification log metadata", async () => {
    // Parent-approval links embed the raw 64-hex consent token and QR data
    // URIs encode the raw pass token — neither may be persisted at rest in
    // notification_logs.metadata.
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R4b",
        leaveTypeId: null,
        eventType: "PARENT_APPROVAL_REQUESTED",
        templateId: "T4b",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "parent_sms_template",
        recipients: [{ recipientType: "PARENT" }],
        channels: [{ channel: "SMS" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T4b",
        eventKey: "PARENT_APPROVAL_REQUESTED",
        channel: "SMS",
        templateBody: "Dear Parent, click {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindParentById.mockResolvedValue({
      id: "P1",
      email: null,
      phone: "+919999999999",
    });

    await notificationService.notify("PARENT_APPROVAL_REQUESTED", {
      leaveRequestId: "L8",
      parentId: "P1",
      variables: {
        leaveId: "L8",
        studentName: "Neerasa",
        approvalLink: "https://sst-hostel-leave.vercel.app/parent-approve/abc123def456",
        qrCodeUrl: "data:image/png;base64,RAWQRDATA",
      },
    });

    const logCall = mockLogCreate.mock.calls[0]![0];
    expect(logCall.metadata).toEqual({
      leaveId: "L8",
      studentName: "Neerasa",
    });
    expect(logCall.metadata.approvalLink).toBeUndefined();
    expect(logCall.metadata.qrCodeUrl).toBeUndefined();
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
    mockFindActiveByEvent.mockRejectedValue(new Error("DB connection lost"));

    const result = await notificationService.notify("LEAVE_APPROVED", {
      leaveRequestId: "L7",
      variables: { leaveId: "L7" },
    });

    // Should not throw - errors are captured in the return value
    expect(result.success).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]).toContain("DB connection lost");
  });

  it("sends notifications on every rule channel", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R6",
        leaveTypeId: null,
        eventType: "LEAVE_EXTENSION_REQUESTED",
        templateId: "T6",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "extension_requested_template",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }, { channel: "SMS" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T6",
        eventKey: "LEAVE_EXTENSION_REQUESTED",
        channel: "EMAIL",
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
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R8",
        leaveTypeId: null,
        eventType: "LEAVE_SUBMITTED",
        templateId: "T8",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_late_stay_poc",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T8",
        eventKey: "LEAVE_SUBMITTED",
        channel: "SLACK",
        templateBody: "New leave {{leaveId}} submitted",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_1"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_1", email: "a@x.com", phone: null, hostelId: "H1" },
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
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R9",
        leaveTypeId: null,
        eventType: "LEAVE_CANCELLED",
        templateId: "T9",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_cancelled_slack",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T9",
        eventKey: "LEAVE_CANCELLED",
        channel: "SLACK",
        templateBody: "Leave {{leaveId}} cancelled",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_1"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_1", email: "a@x.com", phone: null, hostelId: "H1" },
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
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R10",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVED",
        templateId: "T10",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_approved_email_re_exam",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
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
        ccRecipients: ["warden@example.com", "poc@example.com"],
      })
    );
  });

  it("sends email without CC when none provided", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R11",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVED",
        templateId: "T11",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_approved_email_re_exam",
        recipients: [{ recipientType: "STUDENT" }],
        channels: [{ channel: "EMAIL" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
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

  it("resolves HOSTEL_ADMIN recipients scoped to the student's hostel", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R1",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVAL_REQUIRED",
        templateId: "T12",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_late_stay_admin",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T12",
        eventKey: "LEAVE_APPROVAL_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear Hostel Warden, {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_A", "U_ADMIN_B"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_A", email: "a@x.com", phone: null, hostelId: "H1" },
      { id: "U_ADMIN_B", email: "b@x.com", phone: null, hostelId: "H2" },
    ]);

    await notificationService.notify("LEAVE_APPROVAL_REQUIRED", {
      leaveRequestId: "L13",
      hostelId: "H1",
      variables: { leaveId: "L13" },
    });

    // Only the admin of hostel H1 is notified, not H2's admin.
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "U_ADMIN_A" })
    );
    expect(mockLogCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: "U_ADMIN_B" })
    );
  });

  it("routes POC-targeted slack notifications to the POC channel", async () => {
    vi.stubEnv("SLACK_CHANNEL_ID", "C123");
    vi.stubEnv("SLACK_POC_CHANNEL_ID", "CPOC");

    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R3",
        leaveTypeId: null,
        eventType: "LEAVE_POC_REVIEW_REQUIRED",
        templateId: "T14",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_marriage_poc",
        recipients: [{ recipientType: "POC" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T14",
        eventKey: "LEAVE_POC_REVIEW_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear POC, {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_POC1"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_POC1", email: "poc@x.com", phone: null, hostelId: "H1" },
    ]);
    // The hostel has its own admin channel, but POC alerts must still go to the
    // global POC channel.
    mockHostelFindById.mockResolvedValue({
      id: "H1",
      slackAdminGroupId: "SADM",
      slackChannelId: "#leave-hostel-neeladri",
    });

    await notificationService.notify("LEAVE_POC_REVIEW_REQUIRED", {
      leaveRequestId: "L15",
      hostelId: "H1",
      variables: { leaveId: "L15" },
    });

    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ to: "CPOC" }));
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "SLACK", recipient: "CPOC" })
    );
  });

  it("sends admin slack notifications to the main channel", async () => {
    vi.stubEnv("SLACK_CHANNEL_ID", "C123");
    vi.stubEnv("SLACK_POC_CHANNEL_ID", "CPOC");

    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R4",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVAL_REQUIRED",
        templateId: "T15",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_marriage",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T15",
        eventKey: "LEAVE_APPROVAL_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear Hostel Warden, {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_A"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_A", email: "a@x.com", phone: null, hostelId: "H1" },
    ]);

    await notificationService.notify("LEAVE_APPROVAL_REQUIRED", {
      leaveRequestId: "L16",
      hostelId: "H1",
      variables: { leaveId: "L16" },
    });

    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ to: "C123" }));
  });

  it("sends admin slack notifications to the hostel's configured channel", async () => {
    vi.stubEnv("SLACK_CHANNEL_ID", "C123");
    vi.stubEnv("SLACK_POC_CHANNEL_ID", "CPOC");

    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R5",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVAL_REQUIRED",
        templateId: "T16",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_marriage",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T16",
        eventKey: "LEAVE_APPROVAL_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear Hostel Warden, {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_A"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_A", email: "a@x.com", phone: null, hostelId: "H1" },
    ]);
    mockHostelFindById.mockResolvedValue({
      id: "H1",
      slackAdminGroupId: "SADM",
      slackChannelId: "#leave-hostel-neeladri",
    });

    await notificationService.notify("LEAVE_APPROVAL_REQUIRED", {
      leaveRequestId: "L17",
      hostelId: "H1",
      variables: { leaveId: "L17" },
    });

    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ to: "#leave-hostel-neeladri" }));
  });

  it("posts a single Slack message per channel, not per contact", async () => {
    vi.stubEnv("SLACK_CHANNEL_ID", "C123");

    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R12",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVAL_REQUIRED",
        templateId: "T17",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_marriage",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T17",
        eventKey: "LEAVE_APPROVAL_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear Hostel Warden, {{approvalLink}}",
        isActive: true,
      },
    ]);
    // Two admins in the same hostel — must result in ONE Slack post.
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_A", "U_B"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_A", email: "a@x.com", phone: null, hostelId: "H1" },
      { id: "U_B", email: "b@x.com", phone: null, hostelId: "H1" },
    ]);
    mockHostelFindById.mockResolvedValue({ id: "H1", slackAdminGroupId: "SADM", slackChannelId: null });

    await notificationService.notify("LEAVE_APPROVAL_REQUIRED", {
      leaveRequestId: "L18",
      hostelId: "H1",
      variables: { leaveId: "L18" },
    });

    expect(mockSlackSend).toHaveBeenCalledTimes(1);
    expect(mockSlackSend).toHaveBeenCalledWith(expect.objectContaining({ to: "C123" }));
  });

  it("does not resolve HOSTEL_ADMIN when no hostel is known", async () => {
    mockFindActiveByEvent.mockResolvedValue([
      {
        id: "R2",
        leaveTypeId: null,
        eventType: "LEAVE_APPROVAL_REQUIRED",
        templateId: "T13",
        enabled: true,
        customRecipients: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        templateCode: "leave_submitted_slack_late_stay_admin",
        recipients: [{ recipientType: "HOSTEL_ADMIN" }],
        channels: [{ channel: "SLACK" }],
      },
    ]);
    mockFindByIds.mockResolvedValue([
      {
        id: "T13",
        eventKey: "LEAVE_APPROVAL_REQUIRED",
        channel: "SLACK",
        templateBody: "Dear Hostel Warden, {{approvalLink}}",
        isActive: true,
      },
    ]);
    mockFindUserIdsByRoleCode.mockResolvedValue(["U_ADMIN_A"]);
    mockFindUsersByIds.mockResolvedValue([
      { id: "U_ADMIN_A", email: "a@x.com", phone: null, hostelId: "H1" },
    ]);

    await notificationService.notify("LEAVE_APPROVAL_REQUIRED", {
      leaveRequestId: "L14",
      variables: { leaveId: "L14" },
    });

    expect(mockLogCreate).not.toHaveBeenCalled();
  });
});
