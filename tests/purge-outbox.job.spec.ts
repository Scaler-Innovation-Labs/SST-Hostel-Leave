// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindProcessedBefore = vi.fn().mockResolvedValue([]);
const mockDeleteByIdsIfProcessed = vi.fn().mockResolvedValue(0);
const mockLoggerInfo = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    findProcessedBefore: (...args: any[]) => mockFindProcessedBefore(...args),
    deleteByIdsIfProcessed: (...args: any[]) => mockDeleteByIdsIfProcessed(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: any[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  OUTBOX_PROCESSED_RETENTION_HOURS,
  OUTBOX_PURGE_BATCH_SIZE,
} from "@/constants/outbox/outbox-retention";
import { runPurgeOutboxJob } from "@/services/cron/purge-outbox.job";

describe("runPurgeOutboxJob", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks): queued mockResolvedValueOnce
    // values from a prior test must not leak into the next one.
    vi.resetAllMocks();
    mockFindProcessedBefore.mockResolvedValue([]);
    mockDeleteByIdsIfProcessed.mockResolvedValue(0);
  });

  it("purges eligible processed events and reports the count", async () => {
    mockFindProcessedBefore
      .mockResolvedValueOnce([{ id: "E1" }, { id: "E2" }])
      .mockResolvedValueOnce([]);
    mockDeleteByIdsIfProcessed.mockResolvedValueOnce(2);

    const result = await runPurgeOutboxJob(new Date("2026-09-05T12:00:00Z"));

    expect(result.job).toBe("purge-outbox");
    expect(result.purged).toBe(2);
    // 48h retention window before now.
    expect(result.cutoff).toBe(
      new Date(
        new Date("2026-09-05T12:00:00Z").getTime() -
          OUTBOX_PROCESSED_RETENTION_HOURS * 60 * 60 * 1000
      ).toISOString()
    );
    expect(mockDeleteByIdsIfProcessed).toHaveBeenCalledWith(["E1", "E2"]);
  });

  it("only deletes ids returned by the PROCESSED-constrained finder", async () => {
    // Eligibility lives in findProcessedBefore (status = PROCESSED AND
    // processed before cutoff): PENDING / PROCESSING / FAILED rows are
    // never candidates, so they can never reach the delete call. The job
    // must pass finder output through verbatim — no id synthesis.
    mockFindProcessedBefore
      .mockResolvedValueOnce([{ id: "E1" }, { id: "E2" }])
      .mockResolvedValueOnce([]);
    mockDeleteByIdsIfProcessed.mockResolvedValueOnce(2);

    const now = new Date("2026-09-05T12:00:00Z");
    await runPurgeOutboxJob(now);

    expect(mockFindProcessedBefore).toHaveBeenCalledWith(
      new Date(now.getTime() - OUTBOX_PROCESSED_RETENTION_HOURS * 60 * 60 * 1000),
      expect.any(Number)
    );
    expect(mockDeleteByIdsIfProcessed).toHaveBeenCalledTimes(1);
    expect(mockDeleteByIdsIfProcessed).toHaveBeenCalledWith(["E1", "E2"]);
  });
  it("drains multiple batches until the finder runs dry", async () => {
    const fullBatch = Array.from({ length: OUTBOX_PURGE_BATCH_SIZE }, (_, i) => ({
      id: `E${i}`,
    }));
    mockFindProcessedBefore
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: "E-tail" }])
      .mockResolvedValueOnce([]);
    mockDeleteByIdsIfProcessed
      .mockResolvedValueOnce(OUTBOX_PURGE_BATCH_SIZE)
      .mockResolvedValueOnce(1);

    const result = await runPurgeOutboxJob();

    expect(result.purged).toBe(OUTBOX_PURGE_BATCH_SIZE + 1);
    expect(mockDeleteByIdsIfProcessed).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no processed events aged past retention", async () => {
    const result = await runPurgeOutboxJob();

    expect(result.purged).toBe(0);
    expect(mockDeleteByIdsIfProcessed).not.toHaveBeenCalled();
  });

  it("logs counts only — never ids, payloads, links, or tokens", async () => {
    mockFindProcessedBefore.mockResolvedValueOnce([{ id: "E1" }]);
    mockDeleteByIdsIfProcessed.mockResolvedValueOnce(1);

    await runPurgeOutboxJob();

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const [message, meta] = mockLoggerInfo.mock.calls[0];
    expect(message).toContain("purge");
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain("E1");
    expect(serialized).not.toMatch(/approvalLink|token|payload/i);
    expect(meta.purged).toBe(1);
  });

  it("is idempotent: a second run after a full drain purges nothing new", async () => {
    mockFindProcessedBefore
      .mockResolvedValueOnce([{ id: "E1" }])
      .mockResolvedValue([]);
    mockDeleteByIdsIfProcessed.mockResolvedValue(1);

    const first = await runPurgeOutboxJob();
    const second = await runPurgeOutboxJob();

    expect(first.purged).toBe(1);
    // Second run: finder returns [] immediately, no further deletes.
    expect(second.purged).toBe(0);
    expect(mockDeleteByIdsIfProcessed).toHaveBeenCalledTimes(1);
  });
});
