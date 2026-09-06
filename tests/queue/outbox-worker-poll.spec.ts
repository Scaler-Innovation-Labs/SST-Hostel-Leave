// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockReceiveQueueMessages = vi.fn();
const mockDeleteQueueMessage = vi.fn();
const mockProcessSingleEvent = vi.fn();

vi.mock("@/lib/sqs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/sqs")>();
  return {
    ...actual,
    receiveQueueMessages: (...args: any[]) =>
      mockReceiveQueueMessages(...args),
    deleteQueueMessage: (...args: any[]) =>
      mockDeleteQueueMessage(...args),
  };
});

vi.mock("@/services/outbox/outbox-worker.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/outbox/outbox-worker.service")
    >();
  return {
    ...actual,
    processSingleEvent: (...args: any[]) =>
      mockProcessSingleEvent(...args),
  };
});

import { pollOnce } from "../../scripts/outbox-worker";

function makeMessage(overrides = {}) {
  return {
    messageId: "sqs-1",
    receiptHandle: "rh-1",
    body: { eventId: "evt-1", eventType: "LEAVE_APPROVED" },
    receiveCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteQueueMessage.mockResolvedValue(undefined);
  mockProcessSingleEvent.mockResolvedValue("processed");
});

describe("pollOnce", () => {
  it("returns zeros when no messages are received", async () => {
    mockReceiveQueueMessages.mockResolvedValue([]);

    const result = await pollOnce();

    expect(result).toEqual({ received: 0, deleted: 0, retained: 0 });
    expect(mockDeleteQueueMessage).not.toHaveBeenCalled();
  });

  it("deletes the message after successful processing", async () => {
    mockReceiveQueueMessages.mockResolvedValue([makeMessage()]);
    mockProcessSingleEvent.mockResolvedValue("processed");

    const result = await pollOnce();

    expect(mockProcessSingleEvent).toHaveBeenCalledWith("evt-1");
    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-1");
    expect(result).toEqual({ received: 1, deleted: 1, retained: 0 });
  });

  it("does NOT delete the message on transient failure (redrive retries it)", async () => {
    mockReceiveQueueMessages.mockResolvedValue([makeMessage()]);
    mockProcessSingleEvent.mockResolvedValue("failed-transient");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ received: 1, deleted: 0, retained: 1 });
  });

  it("does NOT delete the message when another worker holds the claim", async () => {
    mockReceiveQueueMessages.mockResolvedValue([makeMessage()]);
    mockProcessSingleEvent.mockResolvedValue("skipped-claimed");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ received: 1, deleted: 0, retained: 1 });
  });

  it("deletes the message for duplicate (already processed) deliveries", async () => {
    mockReceiveQueueMessages.mockResolvedValue([makeMessage()]);
    mockProcessSingleEvent.mockResolvedValue("skipped-processed");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-1");
    expect(result).toEqual({ received: 1, deleted: 1, retained: 0 });
  });

  it("deletes the message for terminal failures and missing rows", async () => {
    mockReceiveQueueMessages.mockResolvedValue([
      makeMessage({ receiptHandle: "rh-terminal", body: { eventId: "e1" } }),
      makeMessage({ receiptHandle: "rh-missing", body: { eventId: "e2" } }),
    ]);
    mockProcessSingleEvent
      .mockResolvedValueOnce("failed-terminal")
      .mockResolvedValueOnce("missing");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-terminal");
    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-missing");
    expect(result).toEqual({ received: 2, deleted: 2, retained: 0 });
  });

  it("logs and deletes malformed messages without invoking the handler", async () => {
    mockReceiveQueueMessages.mockResolvedValue([
      makeMessage({ body: { eventId: "" } }),
    ]);

    const result = await pollOnce();

    expect(mockProcessSingleEvent).not.toHaveBeenCalled();
    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-1");
    expect(result).toEqual({ received: 1, deleted: 1, retained: 0 });
  });

  it("retains the message when handling throws unexpectedly", async () => {
    mockReceiveQueueMessages.mockResolvedValue([makeMessage()]);
    mockProcessSingleEvent.mockRejectedValueOnce(new Error("DB down"));

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ received: 1, deleted: 0, retained: 1 });
  });

  it("propagates receive-level failures to the daemon backoff", async () => {
    mockReceiveQueueMessages.mockRejectedValueOnce(new Error("SQS down"));

    await expect(pollOnce()).rejects.toThrow("SQS down");
  });

  it("retains a missing row when the message is fresh (pre-commit race)", async () => {
    mockReceiveQueueMessages.mockResolvedValue([
      makeMessage({
        body: { eventId: "uncommitted-yet" },
        sentTimestampMs: Date.now(),
      }),
    ]);
    mockProcessSingleEvent.mockResolvedValue("missing");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ received: 1, deleted: 0, retained: 1 });
  });

  it("deletes a missing row when the message is old (purged row)", async () => {
    mockReceiveQueueMessages.mockResolvedValue([
      makeMessage({
        receiptHandle: "rh-old",
        body: { eventId: "purged-long-ago" },
        sentTimestampMs: Date.now() - 120_000,
      }),
    ]);
    mockProcessSingleEvent.mockResolvedValue("missing");

    const result = await pollOnce();

    expect(mockDeleteQueueMessage).toHaveBeenCalledWith("rh-old");
    expect(result).toEqual({ received: 1, deleted: 1, retained: 0 });
  });
});
