// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDocFindById = vi.fn();
const mockLeaveFindById = vi.fn();
const mockExtensionFindById = vi.fn();
const mockAssertCanAccessLeave = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock("@/db/repositories/leave/leave-document.repository", () => ({
  leaveDocumentRepository: {
    findById: (...args: any[]) => mockDocFindById(...args),
    updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: { findById: (...args: any[]) => mockLeaveFindById(...args) },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: { findById: (...args: any[]) => mockExtensionFindById(...args) },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: (...args: any[]) => mockAssertCanAccessLeave(...args),
}));

vi.mock("@/lib/s3", () => ({
  deleteByKey: vi.fn().mockResolvedValue(true),
  extractKeyFromUrl: vi.fn().mockReturnValue(null),
  getS3KeyFromMetadata: vi.fn().mockReturnValue(null),
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { ValidationError } from "@/lib/errors";
import { deleteLeaveDocument } from "@/services/leave/documents/delete-document.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockDocFindById.mockResolvedValue({
    id: "D1",
    leaveRequestId: "LR1",
    fileName: "doc.pdf",
    fileUrl: "https://x/y",
    mimeType: "application/pdf",
    metadata: null,
  });
  mockLeaveFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });
  mockAssertCanAccessLeave.mockResolvedValue(undefined);
});

describe("deleteLeaveDocument leave binding", () => {
  it("deletes when the path leave matches the document's leave", async () => {
    await deleteLeaveDocument("D1", { id: "U1", roles: ["STUDENT"] }, "LR1");

    expect(mockUpdateStatus).toHaveBeenCalledWith("D1", "DELETED");
  });

  it("rejects a mismatched path leave id without deleting", async () => {
    await expect(
      deleteLeaveDocument("D1", { id: "U1", roles: ["STUDENT"] }, "OTHER")
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("preserves legacy callers that omit the leave id", async () => {
    await deleteLeaveDocument("D1", { id: "U1", roles: ["STUDENT"] });

    expect(mockUpdateStatus).toHaveBeenCalledWith("D1", "DELETED");
  });

  it("enforces leave authorization when deleting an extension-owned document", async () => {
    mockDocFindById.mockResolvedValue({
      id: "D_EXT",
      leaveRequestId: null,
      leaveExtensionId: "EXT1",
      fileName: "ext.pdf",
      fileUrl: "https://x/y",
      mimeType: "application/pdf",
      metadata: null,
    });
    mockExtensionFindById.mockResolvedValue({ id: "EXT1", leaveRequestId: "LR1" });

    await deleteLeaveDocument("D_EXT", { id: "U1", roles: ["STUDENT"] });

    expect(mockExtensionFindById).toHaveBeenCalledWith("EXT1");
    expect(mockAssertCanAccessLeave).toHaveBeenCalledWith(
      { id: "U1", roles: ["STUDENT"] },
      { id: "LR1", studentId: "S1" }
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith("D_EXT", "DELETED");
  });

  it("fails closed when a document has neither leaveRequestId nor leaveExtensionId", async () => {
    mockDocFindById.mockResolvedValue({
      id: "D_ORPHAN",
      leaveRequestId: null,
      leaveExtensionId: null,
      fileName: "orphan.pdf",
      fileUrl: "https://x/y",
      mimeType: "application/pdf",
      metadata: null,
    });

    await expect(
      deleteLeaveDocument("D_ORPHAN", { id: "U1", roles: ["STUDENT"] })
    ).rejects.toThrow("LeaveRequest");

    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });
});
