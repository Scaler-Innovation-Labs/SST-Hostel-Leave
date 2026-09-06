import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { deleteByPublicId, uploadFromBuffer } from "@/lib/cloudinary";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_DOCUMENT_TYPE_LENGTH = 50;

/**
 * Magic-byte signatures per allowed MIME type. `file.type` is a
 * client-supplied multipart header — without this, an HTML/JS polyglot
 * labeled application/pdf uploads as `raw` and persists behind a public
 * Cloudinary URL (stored-XSS primitive for the next viewer).
 */
const MAGIC_BYTES: Array<{ mime: string; signature: number[] }> = [
  { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", signature: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/msword", signature: [0xd0, 0xcf, 0x11, 0xe0] },
  // docx is a zip container.
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: [0x50, 0x4b],
  },
];

function assertMagicBytes(buffer: Buffer, mimeType: string): void {
  const entry = MAGIC_BYTES.find((e) => e.mime === mimeType);
  if (!entry) {
    throw new ValidationError("File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX");
  }
  const matches = entry.signature.every((byte, i) => buffer[i] === byte);
  if (!matches) {
    throw new ValidationError("File content does not match its declared type");
  }
}

export type UploadDocumentResult = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  documentType: string;
  documentStatus: string;
  createdAt: Date;
};

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_DOCUMENTS_FOLDER ?? "sst-hostel-leave-documents";

export async function uploadLeaveDocument(
  leaveRequestId: string,
  file: File,
  documentType: string,
  uploadedBy: string,
  currentUser: CurrentUser,
): Promise<UploadDocumentResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError("File size must be less than 10MB");
  }

  if (file.size === 0) {
    throw new ValidationError("File cannot be empty");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ValidationError("File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX");
  }

  const normalizedDocumentType = documentType.trim().slice(0, MAX_DOCUMENT_TYPE_LENGTH) || "GENERAL";

  const leave = await leaveRepository.findById(leaveRequestId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  // IDOR guard: students may only upload to their own leaves; staff must be
  // within the leave's hostel scope.
  await assertCanAccessLeave(currentUser, leave);

  const buffer = Buffer.from(await file.arrayBuffer());
  assertMagicBytes(buffer, file.type);
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();

  const uploadResult = await uploadFromBuffer(buffer, {
    folder: `${CLOUDINARY_FOLDER}/leaves/${leaveRequestId}`,
    publicId: uniqueId,
    resourceType: file.type.startsWith("image/") ? "image" : "raw",
  });

  // Compensation: the upload above cannot join a DB transaction. If the
  // row insert fails, delete the orphaned Cloudinary object so a billed,
  // publicly-addressable file never outlives its record.
  let document;
  try {
    document = await leaveDocumentRepository.create({
      leaveRequestId,
      uploadedBy,
      documentType: normalizedDocumentType,
      documentStatus: "ACTIVE",
      fileName: sanitizedFileName,
      fileUrl: uploadResult.secureUrl,
      mimeType: file.type,
      fileSize: file.size,
      metadata: {
        cloudinaryPublicId: uploadResult.publicId,
        cloudinaryFormat: uploadResult.format,
      },
    });
  } catch (error) {
    await deleteByPublicId(
      uploadResult.publicId,
      file.type.startsWith("image/") ? "image" : "raw"
    ).catch(() => {
      // Best-effort: the original error is what the caller must see.
    });
    throw error;
  }

  return {
    id: document.id,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    documentType: document.documentType,
    documentStatus: document.documentStatus,
    createdAt: document.createdAt,
  };
}
