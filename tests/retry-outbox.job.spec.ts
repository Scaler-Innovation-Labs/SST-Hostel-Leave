// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFailStuckProcessing = vi.fn();
const mockRequeueStuckProcessing = vi.fn();
const mockFindFailed = vi.fn();
const mockMarkForRetry = vi.fn();
const mockProcessPendingEvents = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    failStuckProcessing: (...args: any[]) => mockFailStuckProcessing(...args),
    requeueStuckProcessing: (...args: any[]) => mockRequeueStuckProcessing(...args),
    findFailed: (...args: any[]) => mockFindFailed(...args),
    markForRetry: (...args: any[]) => mockMarkForRetry(...args),
  },
}));

vi.mock("@/services/outbox/outbox-worker.service", () => ({
  MAX_RETRIES: 5,
  processPendingEvents: (...args: any[]) => mockProcessPendingEvents(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: any[]) => mockLoggerError(...args),
    debug: vi.fn(),
  },
}));

import { runRetryOutboxJob } from "@/services/cron/retry-outbox.job";

beforeEach(() => {
  vi.resetAllMocks();
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

describe("runRetryOutboxJob", () => {
  it("terminal-fails exhausted stale claims before requeueing the rest", async () => {
    mockFailStuckProcessing.mockResolvedValue(2);
    mockRequeueStuckProcessing.mockResolvedValue(3);

    const result = await runRetryOutboxJob();

    expect(mockFailStuckProcessing).toHaveBeenCalledWith(15, 5);
    expect(mockRequeueStuckProcessing).toHaveBeenCalledWith(15);
    expect(mockFailStuckProcessing.mock.invocationCallOrder[0]).toBeLessThan(
      mockRequeueStuckProcessing.mock.invocationCallOrder[0]
    );
    expect(result.failedStuck).toBe(2);
    expect(result.recoveredStuck).toBe(3);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Outbox events exhausted retries after stale leases",
      { failedStuck: 2 }
    );
  });

  it("resets only FAILED rows that still have retry budget", async () => {
    mockFindFailed.mockResolvedValue([{ id: "OE1" }, { id: "OE2" }]);
    mockMarkForRetry
      .mockResolvedValueOnce({ id: "OE1" })
      .mockResolvedValueOnce(null);

    const result = await runRetryOutboxJob();

    expect(mockFindFailed).toHaveBeenCalledWith(100, 5);
    expect(mockMarkForRetry).toHaveBeenCalledTimes(2);
    expect(result.resetCount).toBe(1);
  });

  it("returns the worker drain counts alongside recovery counts", async () => {
    mockProcessPendingEvents.mockResolvedValue({
      processed: 4,
      failed: 1,
      skipped: 2,
    });

    const result = await runRetryOutboxJob();

    expect(result).toEqual({
      job: "retry-outbox",
      failedStuck: 0,
      recoveredStuck: 0,
      resetCount: 0,
      processed: 4,
      failed: 1,
      skipped: 2,
    });
  });
});
