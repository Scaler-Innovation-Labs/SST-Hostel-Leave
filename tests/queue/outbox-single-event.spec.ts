// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockMarkProcessing = vi.fn();
const mockMarkProcessed = vi.fn();
const mockMarkFailed = vi.fn();
const mockReleaseForRetry = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    markProcessing: (...args: any[]) => mockMarkProcessing(...args),
    markProcessed: (...args: any[]) => mockMarkProcessed(...args),
    markFailed: (...args: any[]) => mockMarkFailed(...args),
    releaseForRetry: (...args: any[]) => mockReleaseForRetry(...args),
  },
}));

const mockHandleLeaveEvent = vi.fn();
const mockHandleMovementEvent = vi.fn();
const mockHandleNotificationEvent = vi.fn();

vi.mock("@/services/outbox/handlers/leave-event.handler", () => ({
  handleLeaveEvent: (...args: any[]) => mockHandleLeaveEvent(...args),
}));
vi.mock("@/services/outbox/handlers/movement-event.handler", () => ({
  handleMovementEvent: (...args: any[]) => mockHandleMovementEvent(...args),
}));
vi.mock("@/services/outbox/handlers/notification-event.handler", () => ({
  handleNotificationEvent: (...args: any[]) =>
    mockHandleNotificationEvent(...args),
}));

import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import {
  isTerminalOutcome,
  processSingleEvent,
} from "@/services/outbox/outbox-worker.service";

function makeRow(overrides = {}) {
  return {
    id: "evt-1",
    eventType: "LEAVE_APPROVED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: {},
    status: OUTBOX_STATUS.PENDING,
    attemptCount: 0,
    lastError: null,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    createdAt: new Date(),
    processedAt: null,
    claimedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHandleLeaveEvent.mockResolvedValue(undefined);
  mockHandleMovementEvent.mockResolvedValue(undefined);
  mockHandleNotificationEvent.mockResolvedValue(undefined);
});

describe("processSingleEvent", () => {
  it("processes a PENDING event and marks it PROCESSED", async () => {
    const pending = makeRow();
    const claimed = { ...pending, status: OUTBOX_STATUS.PROCESSING };
    mockFindById.mockResolvedValue(pending);
    mockMarkProcessing.mockResolvedValue(claimed);

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("processed");
    expect(mockMarkProcessing).toHaveBeenCalledWith("evt-1");
    expect(mockHandleLeaveEvent).toHaveBeenCalledTimes(1);
    expect(mockMarkProcessed).toHaveBeenCalledWith("evt-1");
  });

  it("skips an already PROCESSED event without running the handler (duplicate delivery)", async () => {
    mockFindById.mockResolvedValue(
      makeRow({ status: OUTBOX_STATUS.PROCESSED })
    );

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("skipped-processed");
    expect(mockHandleLeaveEvent).not.toHaveBeenCalled();
    expect(mockMarkProcessing).not.toHaveBeenCalled();
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  it("returns missing for an unknown id without writing anything", async () => {
    mockFindById.mockResolvedValue(null);

    const outcome = await processSingleEvent("nope");

    expect(outcome).toBe("missing");
    expect(mockMarkProcessing).not.toHaveBeenCalled();
    expect(mockMarkProcessed).not.toHaveBeenCalled();
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("returns skipped-claimed when the claim race is lost", async () => {
    mockFindById.mockResolvedValue(makeRow());
    mockMarkProcessing.mockResolvedValue(null);

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("skipped-claimed");
    expect(mockHandleLeaveEvent).not.toHaveBeenCalled();
    expect(mockMarkProcessed).not.toHaveBeenCalled();
  });

  it("returns skipped-claimed for a PROCESSING row owned by another worker", async () => {
    mockFindById.mockResolvedValue(
      makeRow({ status: OUTBOX_STATUS.PROCESSING })
    );

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("skipped-claimed");
    expect(mockMarkProcessing).not.toHaveBeenCalled();
    expect(mockHandleLeaveEvent).not.toHaveBeenCalled();
  });

  it("treats a FAILED row as terminal without re-running the handler", async () => {
    mockFindById.mockResolvedValue(makeRow({ status: OUTBOX_STATUS.FAILED }));

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("failed-terminal");
    expect(mockHandleLeaveEvent).not.toHaveBeenCalled();
  });

  it("marks an unknown event type FAILED (permanent, terminal)", async () => {
    const pending = makeRow({ eventType: "NOPE_UNKNOWN" });
    mockFindById.mockResolvedValue(pending);
    mockMarkProcessing.mockResolvedValue({
      ...pending,
      status: OUTBOX_STATUS.PROCESSING,
    });

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("failed-terminal");
    expect(mockMarkFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.stringContaining("No handler")
    );
    expect(mockReleaseForRetry).not.toHaveBeenCalled();
  });

  it("releases for retry on transient handler failure", async () => {
    mockHandleLeaveEvent.mockRejectedValueOnce(new Error("SES timeout"));
    const pending = makeRow({ attemptCount: 0 });
    mockFindById.mockResolvedValue(pending);
    mockMarkProcessing.mockResolvedValue({
      ...pending,
      status: OUTBOX_STATUS.PROCESSING,
    });

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("failed-transient");
    expect(mockReleaseForRetry).toHaveBeenCalledWith("evt-1");
    expect(mockMarkProcessed).not.toHaveBeenCalled();
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("marks FAILED with consumed budget when attempts are exhausted", async () => {
    mockHandleLeaveEvent.mockRejectedValueOnce(new Error("boom"));
    const pending = makeRow({ attemptCount: 4 });
    mockFindById.mockResolvedValue(pending);
    mockMarkProcessing.mockResolvedValue({
      ...pending,
      status: OUTBOX_STATUS.PROCESSING,
    });

    const outcome = await processSingleEvent("evt-1");

    expect(outcome).toBe("failed-terminal");
    expect(mockMarkFailed).toHaveBeenCalledWith("evt-1", "boom", 5);
    expect(mockReleaseForRetry).not.toHaveBeenCalled();
  });
});

describe("isTerminalOutcome", () => {
  it("maps outcomes to SQS deletion decisions", () => {
    expect(isTerminalOutcome("processed")).toBe(true);
    expect(isTerminalOutcome("skipped-processed")).toBe(true);
    expect(isTerminalOutcome("failed-terminal")).toBe(true);
    expect(isTerminalOutcome("missing")).toBe(true);
    expect(isTerminalOutcome("failed-transient")).toBe(false);
    expect(isTerminalOutcome("skipped-claimed")).toBe(false);
  });
});
