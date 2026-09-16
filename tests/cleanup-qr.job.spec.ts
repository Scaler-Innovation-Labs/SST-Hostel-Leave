// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const tx: Record<string, any> = {};
  tx.insert = vi.fn(() => tx);
  tx.select = vi.fn(() => tx);
  tx.update = vi.fn(() => tx);
  tx.delete = vi.fn(() => tx);
  tx.from = vi.fn(() => tx);
  tx.where = vi.fn(() => tx);
  tx.values = vi.fn(() => tx);
  tx.set = vi.fn(() => tx);
  tx.returning = vi.fn().mockResolvedValue([]);
  tx.limit = vi.fn(() => tx);
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

const mockFindExpired = vi.fn().mockResolvedValue([]);
const mockUpdateStatus = vi.fn();
const mockAuditRecord = vi.fn().mockResolvedValue({});
const mockLoggerError = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findExpired: (...args: any[]) => mockFindExpired(...args),
    updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: any[]) => mockLoggerError(...args),
    debug: vi.fn(),
  },
}));

import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";

function makePass(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "QP1",
    leaveRequestId: "LR1",
    studentId: "S1",
    status: "ACTIVE",
    expiresAt: new Date("2026-06-01T00:00:00.000Z"),
    firstScanAt: null,
    closedAt: null,
    ...overrides,
  };
}

describe("runCleanupQrJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindExpired.mockResolvedValue([]);
  });

  it("does nothing when no pass has closed its window", async () => {
    const result = await runCleanupQrJob();

    expect(result).toEqual({ job: "cleanup-qr", expired: 0, errors: [] });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockAuditRecord).not.toHaveBeenCalled();
  });

  it("expires a closed-window pass and audits it with its job label", async () => {
    mockFindExpired.mockResolvedValueOnce([makePass()]);

    const result = await runCleanupQrJob();

    expect(result).toEqual({ job: "cleanup-qr", expired: 1, errors: [] });
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "QP1",
      "EXPIRED",
      expect.anything()
    );
    // The actor is a described one, not a string: the audit trail stores a
    // NULL uuid and carries the job label in metadata (regression: a literal
    // "SYSTEM" actor made every cron pass throw on the uuid FK column).
    expect(mockAuditRecord).toHaveBeenCalledWith(
      "UPDATE",
      "QR_PASS",
      "QP1",
      expect.objectContaining({ id: null, job: "cleanup-qr" }),
      expect.objectContaining({
        oldStatus: "ACTIVE",
        newStatus: "EXPIRED",
        leaveRequestId: "LR1",
        studentId: "S1",
      }),
      expect.anything()
    );
  });

  it("isolates a failing pass and reports it instead of a green run", async () => {
    mockAuditRecord.mockRejectedValueOnce(new Error("audit write failed"));
    mockFindExpired.mockResolvedValueOnce([
      makePass({ id: "QP-BAD" }),
      makePass({ id: "QP-GOOD" }),
    ]);

    const result = await runCleanupQrJob();

    expect(result.expired).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("QP-BAD");
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "QP-GOOD",
      "EXPIRED",
      expect.anything()
    );
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("stops instead of re-attempting a full batch it cannot retire", async () => {
    mockAuditRecord.mockRejectedValue(new Error("audit write failed"));

    try {
      // A full batch of unretirable passes: the batch is re-queried once and
      // must then stop, rather than looping on the same ids forever.
      mockFindExpired.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => makePass({ id: `QP${i}` }))
      );

      const result = await runCleanupQrJob();

      expect(result.expired).toBe(0);
      expect(result.errors).toHaveLength(100);
      expect(mockFindExpired).toHaveBeenCalledTimes(2);
    } finally {
      mockAuditRecord.mockResolvedValue({});
    }
  });
});
