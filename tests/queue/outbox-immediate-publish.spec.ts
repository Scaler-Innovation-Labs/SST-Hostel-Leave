// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockCreate = vi.fn();
const mockCreateMany = vi.fn();
const mockFindById = vi.fn();
const mockMarkPublished = vi.fn();
const mockPublishOutboxEvent = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    create: (...args: any[]) => mockCreate(...args),
    createMany: (...args: any[]) => mockCreateMany(...args),
    findById: (...args: any[]) => mockFindById(...args),
    markPublished: (...args: any[]) => mockMarkPublished(...args),
  },
}));

vi.mock("@/services/outbox/outbox-publisher.service", () => ({
  publishOutboxEvent: (...args: any[]) => mockPublishOutboxEvent(...args),
}));

import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { outboxService } from "@/services/outbox/outbox.service";

const QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/123/outbox-dev";

function makeInput() {
  return {
    eventType: "LEAVE_CREATED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: {},
  };
}

function makeRow(overrides = {}) {
  return {
    id: "evt-1",
    eventType: "LEAVE_CREATED",
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: {},
    status: OUTBOX_STATUS.PENDING,
    attemptCount: 0,
    publishedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackground(): Promise<void> {
  // The background attempt fires after OUTBOX_IMMEDIATE_DELAY_MS; poll
  // until its re-read lands (3s cap), then yield for send/mark to settle.
  const start = Date.now();
  while (mockFindById.mock.calls.length === 0 && Date.now() - start < 3000) {
    await sleepMs(25);
  }
  await sleepMs(50);
}

let savedQueueUrl: string | undefined;

beforeEach(() => {
  // tests/setup.ts enables fake timers globally; the immediate-publish
  // delay is a real setTimeout, so this file opts back into real timers.
  vi.useRealTimers();
  vi.clearAllMocks();
  savedQueueUrl = process.env.OUTBOX_QUEUE_URL;
  mockPublishOutboxEvent.mockResolvedValue({ eventId: "e", messageId: "m" });
  mockMarkPublished.mockResolvedValue({});
});

afterEach(() => {
  if (savedQueueUrl === undefined) {
    delete process.env.OUTBOX_QUEUE_URL;
  } else {
    process.env.OUTBOX_QUEUE_URL = savedQueueUrl;
  }
});

describe("outboxService immediate SQS publish", () => {
  it("does nothing when no queue is configured (Stage 1 behavior)", async () => {
    delete process.env.OUTBOX_QUEUE_URL;
    mockCreate.mockResolvedValue(makeRow());

    const created = await outboxService.publish(makeInput());
    await sleepMs(100);

    expect(created?.id).toBe("evt-1");
    expect(mockPublishOutboxEvent).not.toHaveBeenCalled();
    expect(mockMarkPublished).not.toHaveBeenCalled();
  });

  it("publishes and stamps a committed row", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreate.mockResolvedValue(makeRow());
    mockFindById.mockResolvedValue(makeRow());

    await outboxService.publish(makeInput());
    await waitForBackground();

    expect(mockPublishOutboxEvent).toHaveBeenCalledWith({
      id: "evt-1",
      eventType: "LEAVE_CREATED",
    });
    expect(mockMarkPublished).toHaveBeenCalledWith("evt-1");
  });

  it("skips silently when the row is still invisible (uncommitted)", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreate.mockResolvedValue(makeRow());
    mockFindById.mockResolvedValue(null);

    await outboxService.publish(makeInput());
    await waitForBackground();

    expect(mockPublishOutboxEvent).not.toHaveBeenCalled();
    expect(mockMarkPublished).not.toHaveBeenCalled();
  });

  it("skips rows that are already published or no longer pending", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreate.mockResolvedValue(makeRow());
    mockFindById.mockResolvedValue(
      makeRow({ publishedAt: new Date(), status: OUTBOX_STATUS.PROCESSED })
    );

    await outboxService.publish(makeInput());
    await waitForBackground();

    expect(mockPublishOutboxEvent).not.toHaveBeenCalled();
  });

  it("swallows send failures — the recovery publisher owns them", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreate.mockResolvedValue(makeRow());
    mockFindById.mockResolvedValue(makeRow());
    mockPublishOutboxEvent.mockRejectedValueOnce(new Error("SQS down"));

    await expect(
      outboxService.publish(makeInput())
    ).resolves.toBeDefined();
    await waitForBackground();

    expect(mockMarkPublished).not.toHaveBeenCalled();
  });

  it("does not kick when the insert was an idempotent duplicate", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreate.mockResolvedValue(null);

    const created = await outboxService.publish(makeInput());
    await sleepMs(100);

    expect(created).toBeNull();
    expect(mockFindById).not.toHaveBeenCalled();
    expect(mockPublishOutboxEvent).not.toHaveBeenCalled();
  });

  it("publishMany attempts every created row", async () => {
    process.env.OUTBOX_QUEUE_URL = QUEUE_URL;
    mockCreateMany.mockResolvedValue([makeRow({ id: "a" }), null]);
    mockFindById.mockImplementation(async (id: string) =>
      makeRow({ id })
    );

    const created = await outboxService.publishMany([makeInput(), makeInput()]);
    await waitForBackground();

    expect(created).toHaveLength(2);
    expect(mockPublishOutboxEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishOutboxEvent).toHaveBeenCalledWith({
      id: "a",
      eventType: "LEAVE_CREATED",
    });
  });
});
