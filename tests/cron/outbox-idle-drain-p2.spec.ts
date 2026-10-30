import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActiveStatusCounts = vi.fn();
const mockFailStuckProcessing = vi.fn();
const mockRequeueStuckProcessing = vi.fn();
const mockFindFailed = vi.fn();
const mockMarkForRetry = vi.fn();
const mockProcessPendingEvents = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    getActiveStatusCounts: (...args: unknown[]) => mockGetActiveStatusCounts(...args),
    failStuckProcessing: (...args: unknown[]) => mockFailStuckProcessing(...args),
    requeueStuckProcessing: (...args: unknown[]) => mockRequeueStuckProcessing(...args),
    findFailed: (...args: unknown[]) => mockFindFailed(...args),
    markForRetry: (...args: unknown[]) => mockMarkForRetry(...args),
  },
}));

vi.mock("@/services/outbox/outbox-worker.service", () => ({
  MAX_RETRIES: 5,
  processPendingEvents: (...args: unknown[]) => mockProcessPendingEvents(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: vi.fn(),
  },
}));

import { runRetryOutboxJob } from "@/services/cron/retry-outbox.job";

beforeEach(() => {
  vi.resetAllMocks();
  mockGetActiveStatusCounts.mockResolvedValue({
    pending: 0,
    processing: 0,
    failed: 0,
    total: 0,
  });
  mockFailStuckProcessing.mockResolvedValue(0);
  mockRequeueStuckProcessing.mockResolvedValue(0);
  mockFindFailed.mockResolvedValue([]);
  mockMarkForRetry.mockResolvedValue(null);
  mockProcessPendingEvents.mockResolvedValue({
    processed: 0,
    failed: 0,
    skipped: 0,
  });
});

describe("P2-B Outbox Idle Drain Optimization", () => {
  it("short-circuits when outbox is idle, avoiding all recovery/retry/claim queries", async () => {
    mockGetActiveStatusCounts.mockResolvedValue({
      pending: 0,
      processing: 0,
      failed: 0,
      total: 0,
    });

    const result = await runRetryOutboxJob();

    expect(mockGetActiveStatusCounts).toHaveBeenCalledTimes(1);
    expect(mockFailStuckProcessing).not.toHaveBeenCalled();
    expect(mockRequeueStuckProcessing).not.toHaveBeenCalled();
    expect(mockFindFailed).not.toHaveBeenCalled();
    expect(mockProcessPendingEvents).not.toHaveBeenCalled();

    expect(result).toEqual({
      job: "retry-outbox",
      failedStuck: 0,
      recoveredStuck: 0,
      resetCount: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it("skips crash recovery and failed reset when only PENDING rows exist", async () => {
    mockGetActiveStatusCounts.mockResolvedValue({
      pending: 3,
      processing: 0,
      failed: 0,
      total: 3,
    });
    mockProcessPendingEvents.mockResolvedValue({
      processed: 3,
      failed: 0,
      skipped: 0,
    });

    const result = await runRetryOutboxJob();

    expect(mockGetActiveStatusCounts).toHaveBeenCalledTimes(1);
    expect(mockFailStuckProcessing).not.toHaveBeenCalled();
    expect(mockRequeueStuckProcessing).not.toHaveBeenCalled();
    expect(mockFindFailed).not.toHaveBeenCalled();
    expect(mockProcessPendingEvents).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      job: "retry-outbox",
      failedStuck: 0,
      recoveredStuck: 0,
      resetCount: 0,
      processed: 3,
      failed: 0,
      skipped: 0,
    });
  });

  it("executes crash recovery when PROCESSING rows exist and drains recovered rows", async () => {
    mockGetActiveStatusCounts.mockResolvedValue({
      pending: 0,
      processing: 2,
      failed: 0,
      total: 2,
    });
    mockFailStuckProcessing.mockResolvedValue(1);
    mockRequeueStuckProcessing.mockResolvedValue(1);
    mockProcessPendingEvents.mockResolvedValue({
      processed: 1,
      failed: 0,
      skipped: 0,
    });

    const result = await runRetryOutboxJob();

    expect(mockFailStuckProcessing).toHaveBeenCalledWith(15, 5);
    expect(mockRequeueStuckProcessing).toHaveBeenCalledWith(15);
    expect(mockFindFailed).not.toHaveBeenCalled();
    expect(mockProcessPendingEvents).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      job: "retry-outbox",
      failedStuck: 1,
      recoveredStuck: 1,
      resetCount: 0,
      processed: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("resets failed events and drains them when FAILED rows exist", async () => {
    mockGetActiveStatusCounts.mockResolvedValue({
      pending: 0,
      processing: 0,
      failed: 1,
      total: 1,
    });
    mockFindFailed.mockResolvedValue([{ id: "failed-event-1" }]);
    mockMarkForRetry.mockResolvedValue({ id: "failed-event-1" });
    mockProcessPendingEvents.mockResolvedValue({
      processed: 1,
      failed: 0,
      skipped: 0,
    });

    const result = await runRetryOutboxJob();

    expect(mockFailStuckProcessing).not.toHaveBeenCalled();
    expect(mockRequeueStuckProcessing).not.toHaveBeenCalled();
    expect(mockFindFailed).toHaveBeenCalledWith(100, 5);
    expect(mockMarkForRetry).toHaveBeenCalledWith("failed-event-1");
    expect(mockProcessPendingEvents).toHaveBeenCalledTimes(1);

    expect(result.resetCount).toBe(1);
    expect(result.processed).toBe(1);
  });
});
