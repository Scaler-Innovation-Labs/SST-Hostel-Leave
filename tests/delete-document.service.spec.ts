// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDocFindById = vi.fn();
const mockLeaveFindById = vi.fn();
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

vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: (...args: any[]) => mockAssertCanAccessLeave(...args),
}));

vi.mock("@/lib/cloudinary", () => ({
  deleteByPublicId: vi.fn().mockResolvedValue(undefined),
  extractPublicIdFromUrl: vi.fn().mockReturnValue(null),
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
});
