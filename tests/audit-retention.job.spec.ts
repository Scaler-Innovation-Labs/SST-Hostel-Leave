// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockDeleteExpired = vi.fn().mockResolvedValue(0);

vi.mock("@/db/repositories/audit/audit.repository", () => ({
  auditRepository: {
    deleteExpired: (...args: any[]) => mockDeleteExpired(...args),
  },
}));

import { runAuditRetentionJob } from "@/services/cron/audit-retention.job";

describe("runAuditRetentionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes expired rows and reports the count", async () => {
    mockDeleteExpired.mockResolvedValueOnce(7);

    const result = await runAuditRetentionJob();

    expect(result).toEqual({ job: "audit-retention", deleted: 7 });
    expect(mockDeleteExpired).toHaveBeenCalledWith(expect.any(Date));
  });

  it("reports zero when nothing has expired", async () => {
    const result = await runAuditRetentionJob();

    expect(result.deleted).toBe(0);
  });
});
