// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockClaimUnpublished = vi.fn();
const mockClaimStalePublished = vi.fn();
const mockMarkPublished = vi.fn();
const mockPublishOutboxEvent = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    claimUnpublished: (...args: any[]) => mockClaimUnpublished(...args),
    claimStalePublished: (...args: any[]) =>
      mockClaimStalePublished(...args),
    markPublished: (...args: any[]) => mockMarkPublished(...args),
  },
}));

vi.mock("@/services/outbox/outbox-publisher.service", () => ({
  publishOutboxEvent: (...args: any[]) => mockPublishOutboxEvent(...args),
}));

import { runPublishOutboxJob } from "@/services/cron/publish-outbox.job";

function makeRow(id: string) {
  return {
    id,
    eventType: "LEAVE_APPROVED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: {},
    status: "PENDING",
    attemptCount: 0,
    publishedAt: null,
    createdAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimUnpublished.mockResolvedValue([]);
  mockClaimStalePublished.mockResolvedValue([]);
  mockPublishOutboxEvent.mockResolvedValue({ eventId: "x", messageId: "m" });
  mockMarkPublished.mockResolvedValue({});
});

describe("runPublishOutboxJob", () => {
  it("publishes fresh rows and stamps them", async () => {
    mockClaimUnpublished.mockResolvedValue([makeRow("e1"), makeRow("e2")]);

    const result = await runPublishOutboxJob();

    expect(result).toEqual({
      job: "publish-outbox",
      published: 2,
      republished: 0,
      failed: 0,
    });
    expect(mockPublishOutboxEvent).toHaveBeenCalledWith({
      id: "e1",
      eventType: "LEAVE_APPROVED",
    });
    expect(mockMarkPublished).toHaveBeenCalledWith("e1");
    expect(mockMarkPublished).toHaveBeenCalledWith("e2");
  });

  it("isolates per-item send failures without aborting the batch", async () => {
    mockClaimUnpublished.mockResolvedValue([makeRow("bad"), makeRow("good")]);
    mockPublishOutboxEvent.mockRejectedValueOnce(new Error("SQS down"));

    const result = await runPublishOutboxJob();

    expect(result.published).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockMarkPublished).not.toHaveBeenCalledWith("bad");
    expect(mockMarkPublished).toHaveBeenCalledWith("good");
  });

  it("republishes stale published-but-unprocessed rows", async () => {
    mockClaimStalePublished.mockResolvedValue([makeRow("stale-1")]);

    const result = await runPublishOutboxJob();

    expect(result.republished).toBe(1);
    expect(result.published).toBe(0);
    expect(mockPublishOutboxEvent).toHaveBeenCalledWith({
      id: "stale-1",
      eventType: "LEAVE_APPROVED",
    });
    expect(mockMarkPublished).toHaveBeenCalledWith("stale-1");
  });

  it("returns zeros when nothing is claimable", async () => {
    const result = await runPublishOutboxJob();

    expect(result).toEqual({
      job: "publish-outbox",
      published: 0,
      republished: 0,
      failed: 0,
    });
    expect(mockPublishOutboxEvent).not.toHaveBeenCalled();
  });

  it("leaves the row unpublished when stamping fails after a successful send", async () => {
    // SendMessage succeeded but markPublished threw: the message is already
    // in SQS, so the row MUST stay unpublished for the recovery publisher
    // to redeliver. The worker absorbs the resulting duplicate idempotently.
    mockClaimUnpublished.mockResolvedValue([makeRow("e1")]);
    mockMarkPublished.mockRejectedValueOnce(new Error("db down"));

    const result = await runPublishOutboxJob();

    expect(mockPublishOutboxEvent).toHaveBeenCalledWith({
      id: "e1",
      eventType: "LEAVE_APPROVED",
    });
    expect(result.published).toBe(0);
    expect(result.failed).toBe(1);
  });
});
