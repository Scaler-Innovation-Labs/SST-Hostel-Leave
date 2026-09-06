// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLeaveFindById = vi.fn();
const mockDocFindById = vi.fn();
const mockDocCreate = vi.fn();
const mockUploadFromBuffer = vi.fn();
const mockAssertCanAccessLeave = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: { findById: (...args: any[]) => mockLeaveFindById(...args) },
}));

vi.mock("@/db/repositories/leave/leave-document.repository", () => ({
  leaveDocumentRepository: {
    findById: (...args: any[]) => mockDocFindById(...args),
    create: (...args: any[]) => mockDocCreate(...args),
  },
}));

vi.mock("@/lib/s3", () => ({
  uploadFromBuffer: (...args: any[]) => mockUploadFromBuffer(...args),
  deleteByKey: vi.fn().mockResolvedValue(true),
  getPresignedGetUrl: vi
    .fn()
    .mockImplementation(async (key: string) => `https://signed.example/${key}`),
  getDocumentsPrefix: () => "sst-hostel-leave-documents",
}));

vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: (...args: any[]) => mockAssertCanAccessLeave(...args),
}));

import { ValidationError } from "@/lib/errors";
import { uploadLeaveDocument } from "@/services/leave/documents/upload-document.service";

function makeFile(bytes: number[], type: string, name = "doc.pdf"): File {
  return {
    size: bytes.length,
    type,
    name,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as File;
}

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const HTML = [...Buffer.from("<html><script>alert(1)</script>")];

beforeEach(() => {
  vi.resetAllMocks();
  mockLeaveFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });
  mockAssertCanAccessLeave.mockResolvedValue(undefined);
  mockUploadFromBuffer.mockResolvedValue({
    url: "https://bucket.s3.ap-south-1.amazonaws.com/prefix/leaves/LR1/abc.pdf",
    key: "prefix/leaves/LR1/abc.pdf",
    bytes: 8,
  });
  mockDocCreate.mockImplementation(async (input: any) => ({ id: "D1", ...input }));
});

describe("uploadLeaveDocument magic-byte verification", () => {
  it("accepts a genuine PDF", async () => {
    const result = await uploadLeaveDocument(
      "LR1",
      makeFile(PDF, "application/pdf"),
      "GENERAL",
      "U1",
      { id: "U1", roles: ["STUDENT"] }
    );

    expect(result.id).toBe("D1");
    expect(mockUploadFromBuffer).toHaveBeenCalledTimes(1);
  });

  it("rejects HTML polyglot labeled as PDF before any upload", async () => {
    await expect(
      uploadLeaveDocument(
        "LR1",
        makeFile(HTML, "application/pdf"),
        "GENERAL",
        "U1",
        { id: "U1", roles: ["STUDENT"] }
      )
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockUploadFromBuffer).not.toHaveBeenCalled();
    expect(mockDocCreate).not.toHaveBeenCalled();
  });

  it("rejects PNG bytes labeled as PDF", async () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    await expect(
      uploadLeaveDocument(
        "LR1",
        makeFile(png, "application/pdf"),
        "GENERAL",
        "U1",
        { id: "U1", roles: ["STUDENT"] }
      )
    ).rejects.toThrow("does not match its declared type");
  });

  it("rejects truncated buffers that cannot satisfy the signature", async () => {
    await expect(
      uploadLeaveDocument(
        "LR1",
        makeFile([0x25, 0x50], "application/pdf"),
        "GENERAL",
        "U1",
        { id: "U1", roles: ["STUDENT"] }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
