// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNotify = vi.fn().mockResolvedValue({ success: true, failures: [] });

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: (...args: any[]) => mockNotify(...args),
  },
}));

const mockFindLeaveById = vi.fn();
const mockFindStudentById = vi.fn();
const mockFindUserById = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindLeaveById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockFindUserById(...args),
  },
}));

import { handleNotificationEvent } from "@/services/outbox/handlers/notification-event.handler";

beforeEach(() => {
  vi.resetAllMocks();
  mockNotify.mockResolvedValue({ success: true, failures: [] });
  mockFindLeaveById.mockResolvedValue({
    id: "L1",
    studentId: "S1",
    leaveTypeId: "LT1",
  });
  mockFindStudentById.mockResolvedValue({ id: "S1", userId: "U1" });
  mockFindUserById.mockResolvedValue({ id: "U1", hostelId: "H1" });
});

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "OE1",
    eventType: "NOTIFICATION_REQUESTED",
    aggregateType: "NOTIFICATION",
    aggregateId: "N1",
    payload: {
      notificationType: "LEAVE_APPROVED",
      leaveRequestId: "L1",
      userId: "U1",
      parentId: null,
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

describe("handleNotificationEvent", () => {
  it("dispatches notification with correct type and context", async () => {
    await handleNotificationEvent(makeEvent());

    expect(mockFindLeaveById).toHaveBeenCalledWith("L1");
    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVED", {
      leaveRequestId: "L1",
      leaveExtensionId: undefined,
      leaveTypeId: "LT1",
      hostelId: "H1",
      userId: "U1",
      parentId: null,
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L1" },
    });
  });

  it("handles extension-specific notification context", async () => {
    await handleNotificationEvent(makeEvent({
      notificationType: "LEAVE_EXTENSION_APPROVED",
      leaveRequestId: "L1",
      leaveExtensionId: "EXT1",
      parentId: "P1",
      variables: { extensionId: "EXT1" },
    }));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_EXTENSION_APPROVED", {
      leaveRequestId: "L1",
      leaveExtensionId: "EXT1",
      leaveTypeId: "LT1",
      hostelId: "H1",
      userId: "U1",
      parentId: "P1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { extensionId: "EXT1" },
    });
  });

  it("omits leaveTypeId and hostelId when the leave cannot be resolved", async () => {
    mockFindLeaveById.mockResolvedValue(null);

    await handleNotificationEvent(makeEvent());

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVED", {
      leaveRequestId: "L1",
      leaveExtensionId: undefined,
      leaveTypeId: undefined,
      hostelId: undefined,
      userId: "U1",
      parentId: null,
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L1" },
    });
  });

  it("skips dispatch when notificationType is missing", async () => {
    await handleNotificationEvent(makeEvent({ notificationType: null }));

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rethrows when notification delivery fails so the outbox retries", async () => {
    mockNotify.mockResolvedValue({
      success: false,
      failures: ["Provider reported delivery failure: 500"],
    });

    await expect(handleNotificationEvent(makeEvent())).rejects.toThrow(
      /Notification delivery failed/
    );
  });
});
