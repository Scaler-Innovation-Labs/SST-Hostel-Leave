// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockClaimNext = vi.fn();
const mockMarkProcessed = vi.fn();
const mockMarkFailed = vi.fn();
const mockReleaseForRetry = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    claimNext: (...args: any[]) => mockClaimNext(...args),
    markProcessed: (...args: any[]) => mockMarkProcessed(...args),
    markFailed: (...args: any[]) => mockMarkFailed(...args),
    releaseForRetry: (...args: any[]) => mockReleaseForRetry(...args),
  },
}));

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/outbox/handlers/leave-event.handler", () => ({
  handleLeaveEvent: vi.fn(),
}));

vi.mock("@/services/outbox/handlers/movement-event.handler", () => ({
  handleMovementEvent: vi.fn(),
}));

vi.mock("@/services/outbox/handlers/notification-event.handler", () => ({
  handleNotificationEvent: vi.fn(),
}));

import { processPendingEvents } from "@/services/outbox/outbox-worker.service";

import { handleLeaveEvent as mockHandleLeaveEvent } from "@/services/outbox/handlers/leave-event.handler";
import { handleMovementEvent as mockHandleMovementEvent } from "@/services/outbox/handlers/movement-event.handler";
import { handleNotificationEvent as mockHandleNotificationEvent } from "@/services/outbox/handlers/notification-event.handler";

beforeEach(() => {
  vi.resetAllMocks();
  mockHandleLeaveEvent.mockResolvedValue(undefined);
  mockHandleMovementEvent.mockResolvedValue(undefined);
  mockHandleNotificationEvent.mockResolvedValue(undefined);
});

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "OE1",
    eventType: overrides.eventType ?? "LEAVE_CREATED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "L1",
    payload: { leaveId: "L1" },
    status: "PENDING",
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

describe("processPendingEvents", () => {
  it("processes a single pending event successfully", async () => {
    const event = makeEvent();
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);
    mockMarkProcessed.mockResolvedValue({ ...event, status: "PROCESSED" });

    const result = await processPendingEvents();

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    // claimNext returns claimed events directly — no separate lock step
    expect(mockMarkProcessed).toHaveBeenCalledWith("OE1");
  });

  it("routes LEAVE_APPROVED event correctly", async () => {
    const event = makeEvent({ eventType: "LEAVE_APPROVED" });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);
    mockMarkProcessed.mockResolvedValue({ ...event, status: "PROCESSED" });

    const result = await processPendingEvents();

    expect(result.processed).toBe(1);
  });

  it("routes PARENT_APPROVAL_REQUIRED event correctly", async () => {
    const event = makeEvent({ eventType: "PARENT_APPROVAL_REQUIRED" });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);
    mockMarkProcessed.mockResolvedValue({ ...event, status: "PROCESSED" });

    const result = await processPendingEvents();

    expect(result.processed).toBe(1);
  });

  it("routes QR_GENERATED event correctly", async () => {
    const event = makeEvent({ eventType: "QR_GENERATED" });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);
    mockMarkProcessed.mockResolvedValue({ ...event, status: "PROCESSED" });

    const result = await processPendingEvents();

    expect(result.processed).toBe(1);
  });

  it("routes NOTIFICATION_REQUESTED event correctly", async () => {
    const event = makeEvent({ eventType: "NOTIFICATION_REQUESTED" });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);
    mockMarkProcessed.mockResolvedValue({ ...event, status: "PROCESSED" });

    const result = await processPendingEvents();

    expect(result.processed).toBe(1);
  });

  it("marks as failed when no handler exists for event type", async () => {
    const event = makeEvent({ eventType: "UNKNOWN_EVENT" });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);

    const result = await processPendingEvents();

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    expect(mockMarkFailed).toHaveBeenCalledWith("OE1", "No handler for event type: UNKNOWN_EVENT");
  });

  it("processes zero events when claimNext returns empty", async () => {
    mockClaimNext.mockResolvedValue([]);

    const result = await processPendingEvents();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 });
  });

  it("requeues event for retry on transient handler failure", async () => {
    mockHandleLeaveEvent.mockRejectedValue(new Error("Handler failed"));
    const event = makeEvent({ attemptCount: 0 });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);

    const result = await processPendingEvents();

    expect(result.failed).toBe(1);
    expect(mockReleaseForRetry).toHaveBeenCalledWith("OE1");
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("marks as failed with exhausted attempt budget after MAX_RETRIES attempts", async () => {
    mockHandleLeaveEvent.mockRejectedValue(new Error("Handler failed"));
    const event = makeEvent({ attemptCount: 4 });
    mockClaimNext.mockResolvedValue([{ ...event, status: "PROCESSING" }]);

    const result = await processPendingEvents();

    expect(result.failed).toBe(1);
    expect(mockMarkFailed).toHaveBeenCalledWith("OE1", "Handler failed", 5);
    expect(mockReleaseForRetry).not.toHaveBeenCalled();
  });

  it("processes multiple batch events", async () => {
    const events = [
      makeEvent({ id: "OE1", eventType: "LEAVE_CREATED" }),
      makeEvent({ id: "OE2", eventType: "LEAVE_APPROVED" }),
      makeEvent({ id: "OE3", eventType: "LEAVE_CANCELLED" }),
    ];

    mockClaimNext.mockResolvedValue(events.map(e => ({ ...e, status: "PROCESSING" })));
    for (const e of events) {
      mockMarkProcessed.mockResolvedValueOnce({ ...e, status: "PROCESSED" });
    }

    const result = await processPendingEvents();

    expect(result).toEqual({ processed: 3, failed: 0, skipped: 0 });
  });
});
