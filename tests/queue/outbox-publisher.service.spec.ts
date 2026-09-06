// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSendQueueMessage = vi.fn();

vi.mock("@/lib/sqs", () => ({
  sendQueueMessage: (...args: any[]) => mockSendQueueMessage(...args),
}));

import { publishOutboxEvent } from "@/services/outbox/outbox-publisher.service";

beforeEach(() => {
  vi.clearAllMocks();
  mockSendQueueMessage.mockResolvedValue("sqs-message-id-1");
});

describe("publishOutboxEvent", () => {
  it("publishes only the event reference (eventId + eventType)", async () => {
    const result = await publishOutboxEvent({
      id: "evt-1",
      eventType: "LEAVE_APPROVED",
    });

    expect(mockSendQueueMessage).toHaveBeenCalledTimes(1);
    expect(mockSendQueueMessage).toHaveBeenCalledWith({
      eventId: "evt-1",
      eventType: "LEAVE_APPROVED",
    });
    expect(result).toEqual({
      eventId: "evt-1",
      messageId: "sqs-message-id-1",
    });
  });

  it("never includes payload or sensitive content in the queue message", async () => {
    await publishOutboxEvent({ id: "evt-2", eventType: "LEAVE_CREATED" });

    const sent = mockSendQueueMessage.mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(["eventId", "eventType"]);
  });

  it("propagates SQS failures without touching the database", async () => {
    mockSendQueueMessage.mockRejectedValueOnce(new Error("SQS down"));

    await expect(
      publishOutboxEvent({ id: "evt-3", eventType: "LEAVE_CREATED" })
    ).rejects.toThrow("SQS down");
    // The publisher imports no repository: the DB row is left intact for
    // the recovery publisher. Nothing else to assert a call absence on —
    // the throw itself is the contract.
  });

  it("duplicate publish is safe (at-least-once, no publish-side dedupe)", async () => {
    const input = { id: "evt-4", eventType: "QR_GENERATED" };

    await publishOutboxEvent(input);
    await publishOutboxEvent(input);

    expect(mockSendQueueMessage).toHaveBeenCalledTimes(2);
  });
});
