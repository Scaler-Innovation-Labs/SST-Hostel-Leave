// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockDeleteExpired = vi.fn().mockResolvedValue(5);

vi.mock("@/db/repositories/rate-limit/rate-limit.repository", () => ({
  rateLimitRepository: {
    deleteExpired: (...args: any[]) => mockDeleteExpired(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { runCleanupRateLimitJob } from "@/services/cron/cleanup-rate-limit.job";

describe("runCleanupRateLimitJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteExpired and returns deleted count", async () => {
    mockDeleteExpired.mockResolvedValueOnce(12);

    const result = await runCleanupRateLimitJob(3600_000);

    expect(mockDeleteExpired).toHaveBeenCalledWith(3600_000);
    expect(result).toEqual({
      job: "cleanup-rate-limit",
      deleted: 12,
    });
  });

  it("defaults to 24-hour retention window", async () => {
    mockDeleteExpired.mockResolvedValueOnce(0);

    const result = await runCleanupRateLimitJob();

    expect(mockDeleteExpired).toHaveBeenCalledWith(86_400_000);
    expect(result).toEqual({
      job: "cleanup-rate-limit",
      deleted: 0,
    });
  });
});
