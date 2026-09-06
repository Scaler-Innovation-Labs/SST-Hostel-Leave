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

const mockFindExpiredForRetention = vi.fn().mockResolvedValue([]);
const mockUpdateStatus = vi.fn();
const mockDeleteByKey = vi.fn().mockResolvedValue(true);
const mockAuditRecord = vi.fn().mockResolvedValue({});

vi.mock("@/db/repositories/leave/leave-document.repository", () => ({
  leaveDocumentRepository: {
    findExpiredForRetention: (...args: any[]) =>
      mockFindExpiredForRetention(...args),
    updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  },
}));

vi.mock("@/lib/s3", () => ({
  deleteByKey: (...args: any[]) => mockDeleteByKey(...args),
  getS3KeyFromMetadata: (metadata: any) => metadata?.s3Key ?? null,
  extractKeyFromUrl: (url: string | null) =>
    url && url.includes(".s3.")
      ? url.split(".amazonaws.com/")[1] ?? null
      : null,
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

import { runDocumentRetentionJob } from "@/services/cron/cleanup-documents.job";

function makeDocument(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "DOC1",
    leaveRequestId: "LR1",
    fileName: "medical-cert.pdf",
    fileUrl:
      "https://sst-docs.s3.ap-south-1.amazonaws.com/prefix/leaves/LR1/medical-cert.pdf",
    mimeType: "application/pdf",
    metadata: { s3Key: "prefix/leaves/LR1/medical-cert.pdf" },
    ...overrides,
  };
}

describe("runDocumentRetentionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindExpiredForRetention.mockResolvedValue([]);
  });

  it("returns zero deleted when no expired documents exist", async () => {
    const result = await runDocumentRetentionJob();

    expect(result.job).toBe("document-retention");
    expect(result.deleted).toBe(0);
    expect(mockDeleteByKey).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("deletes S3 object and soft-deletes DB row for expired documents", async () => {
    mockFindExpiredForRetention.mockResolvedValueOnce([makeDocument()]);

    const result = await runDocumentRetentionJob();

    expect(result.deleted).toBe(1);
    expect(mockDeleteByKey).toHaveBeenCalledWith(
      "prefix/leaves/LR1/medical-cert.pdf"
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith("DOC1", "DELETED");
  });

  it("uses s3Key from metadata regardless of mime type", async () => {
    mockFindExpiredForRetention.mockResolvedValueOnce([
      makeDocument({
        mimeType: "image/png",
        metadata: { s3Key: "prefix/leaves/LR1/xray.png" },
      }),
    ]);

    await runDocumentRetentionJob();

    expect(mockDeleteByKey).toHaveBeenCalledWith("prefix/leaves/LR1/xray.png");
  });

  it("falls back to extracting the key from URL when metadata is missing", async () => {
    mockFindExpiredForRetention.mockResolvedValueOnce([
      makeDocument({ metadata: null }),
    ]);

    await runDocumentRetentionJob();

    expect(mockDeleteByKey).toHaveBeenCalledWith(expect.any(String));
  });

  it("soft-deletes even when the document has no extractable S3 key", async () => {
    mockFindExpiredForRetention.mockResolvedValueOnce([
      makeDocument({
        fileUrl: "https://example.com/not-s3.pdf",
        metadata: null,
      }),
    ]);

    const result = await runDocumentRetentionJob();

    expect(mockDeleteByKey).not.toHaveBeenCalled();
    expect(result.deleted).toBe(1);
    expect(mockUpdateStatus).toHaveBeenCalledWith("DOC1", "DELETED");
  });

  it("records an audit entry per deleted document", async () => {
    mockFindExpiredForRetention.mockResolvedValueOnce([makeDocument()]);

    await runDocumentRetentionJob();

    expect(mockAuditRecord).toHaveBeenCalledTimes(1);
    expect(mockAuditRecord).toHaveBeenCalledWith(
      "DELETE",
      "LEAVE_REQUEST",
      "LR1",
      "SYSTEM",
      expect.objectContaining({
        action: "DOCUMENT_RETENTION_DELETED",
        documentId: "DOC1",
      })
    );
  });

  it("processes multiple batches until exhausted", async () => {
    // First batch full, second batch partial — loop must continue.
    mockFindExpiredForRetention
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, i) =>
          makeDocument({ id: `DOC${i}`, metadata: null, fileUrl: null })
        )
      )
      .mockResolvedValueOnce([makeDocument({ id: "DOC-LAST" })]);

    const result = await runDocumentRetentionJob();

    expect(result.deleted).toBe(101);
    expect(mockFindExpiredForRetention).toHaveBeenCalledTimes(2);
  });

  it("keeps the row ACTIVE when S3 reports not-removed", async () => {
    mockDeleteByKey.mockResolvedValueOnce(false);
    mockFindExpiredForRetention.mockResolvedValueOnce([makeDocument()]);

    const result = await runDocumentRetentionJob();

    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("isolates per-item failures so the rest of the batch still processes", async () => {
    mockDeleteByKey
      .mockRejectedValueOnce(new Error("S3 timeout"))
      .mockResolvedValue(true);
    mockFindExpiredForRetention.mockResolvedValueOnce([
      makeDocument({ id: "DOC-BAD" }),
      makeDocument({ id: "DOC-GOOD" }),
    ]);

    const result = await runDocumentRetentionJob();

    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockUpdateStatus).toHaveBeenCalledWith("DOC-GOOD", "DELETED");
  });
});
