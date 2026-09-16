// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCheckCronAuth = vi.fn();
const mockLoggerError = vi.fn();
const mockRunExpireLeavesJob = vi.fn();
const mockRunCleanupQrJob = vi.fn();
const mockRunDocumentRetentionJob = vi.fn();
const mockRunAuditRetentionJob = vi.fn();
const mockRunPurgeOutboxJob = vi.fn();

vi.mock("@/lib/auth/cron-auth", () => ({
  checkCronAuth: (...args: any[]) => mockCheckCronAuth(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: any[]) => mockLoggerError(...args),
    debug: vi.fn(),
  },
}));

vi.mock("@/services/cron/expire-leaves.job", () => ({
  runExpireLeavesJob: (...args: any[]) => mockRunExpireLeavesJob(...args),
}));

vi.mock("@/services/cron/cleanup-qr.job", () => ({
  runCleanupQrJob: (...args: any[]) => mockRunCleanupQrJob(...args),
}));

vi.mock("@/services/cron/cleanup-documents.job", () => ({
  runDocumentRetentionJob: (...args: any[]) =>
    mockRunDocumentRetentionJob(...args),
}));

vi.mock("@/services/cron/audit-retention.job", () => ({
  runAuditRetentionJob: (...args: any[]) => mockRunAuditRetentionJob(...args),
}));

vi.mock("@/services/cron/purge-outbox.job", () => ({
  runPurgeOutboxJob: (...args: any[]) => mockRunPurgeOutboxJob(...args),
}));

import { GET as cleanup } from "@/app/api/cron/cleanup/route";
import { GET as maintenance } from "@/app/api/cron/maintenance/route";

const CLEAN_BATCH = { total: 0, expired: 0, skipped: 0, errors: [] };
const CLEAN_LIFECYCLE = {
  job: "expire-leaves",
  completed: { total: 0, completed: 0, skipped: 0, errors: [] },
  expired: CLEAN_BATCH,
  overdue: { total: 0, overdue: 0, skipped: 0, errors: [] },
};

function makeRequest() {
  return new Request("http://localhost:3000/api/cron/maintenance", {
    method: "GET",
    headers: { Authorization: "Bearer cron-secret-value" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCronAuth.mockReturnValue(null);
  mockRunExpireLeavesJob.mockResolvedValue(CLEAN_LIFECYCLE);
  mockRunCleanupQrJob.mockResolvedValue({
    job: "cleanup-qr",
    expired: 0,
    errors: [],
  });
  mockRunDocumentRetentionJob.mockResolvedValue({
    job: "document-retention",
    deleted: 0,
    failed: 0,
    cutoff: "2025-01-01T00:00:00.000Z",
    errors: [],
  });
  mockRunAuditRetentionJob.mockResolvedValue({
    job: "audit-retention",
    deleted: 0,
  });
  mockRunPurgeOutboxJob.mockResolvedValue({
    job: "purge-outbox",
    purged: 0,
    cutoff: "2025-01-01T00:00:00.000Z",
  });
});

describe("GET /api/cron/maintenance", () => {
  it("reports a clean pass as a success", async () => {
    const res = await maintenance(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("fails the run when an item could not be transitioned", async () => {
    mockRunExpireLeavesJob.mockResolvedValue({
      ...CLEAN_LIFECYCLE,
      expired: {
        total: 1,
        expired: 0,
        skipped: 0,
        errors: ["Failed to expire LR-1: invalid input syntax for type uuid"],
      },
    });

    const res = await maintenance(makeRequest());
    const body = await res.json();

    // The scheduled pass did work it could not commit: a 200 here is how a
    // broken lifecycle job stayed invisible for days.
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CRON_JOB_FAILED");
    expect(body.error.message).toContain("LR-1");
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("does not run the pass when the cron secret is rejected", async () => {
    mockCheckCronAuth.mockReturnValue(
      Response.json({ success: false }, { status: 401 })
    );

    const res = await maintenance(makeRequest());

    expect(res.status).toBe(401);
    expect(mockRunExpireLeavesJob).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/cleanup", () => {
  it("reports clean jobs as a success", async () => {
    const res = await cleanup(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("fails the run when a job reports item failures", async () => {
    mockRunCleanupQrJob.mockResolvedValue({
      job: "cleanup-qr",
      expired: 0,
      errors: ["Failed to expire QR pass QP1: permission denied"],
    });

    const res = await cleanup(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("CRON_JOB_FAILED");
    expect(body.error.message).toContain("QP1");
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("keeps the other jobs running when one job throws", async () => {
    mockRunCleanupQrJob.mockRejectedValue(new Error("db unavailable"));

    const res = await cleanup(makeRequest());

    expect(res.status).toBe(500);
    expect(mockRunDocumentRetentionJob).toHaveBeenCalled();
    expect(mockRunAuditRetentionJob).toHaveBeenCalled();
    expect(mockRunPurgeOutboxJob).toHaveBeenCalled();
  });
});
