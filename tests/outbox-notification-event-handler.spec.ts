// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNotify = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: (...args: any[]) => mockNotify(...args),
  },
}));

import { handleNotificationEvent } from "@/services/outbox/handlers/notification-event.handler";

beforeEach(() => {
  vi.resetAllMocks();
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

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVED", {
      leaveRequestId: "L1",
      leaveExtensionId: undefined,
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
      userId: "U1",
      parentId: "P1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { extensionId: "EXT1" },
    });
  });

  it("skips dispatch when notificationType is missing", async () => {
    await handleNotificationEvent(makeEvent({ notificationType: null }));

    expect(mockNotify).not.toHaveBeenCalled();
  });
});
