import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { uploadFromBuffer } from "@/lib/cloudinary";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  currentUser?: CurrentUser,
): Promise<UploadDocumentResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError("File size must be less than 10MB");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ValidationError("File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX");
  }

  const leave = await leaveRepository.findById(leaveRequestId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  if (currentUser) {
    await verifyStudentOwnership(currentUser, leave.studentId);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();

  const uploadResult = await uploadFromBuffer(buffer, {
    folder: `${CLOUDINARY_FOLDER}/leaves/${leaveRequestId}`,
    publicId: uniqueId,
    resourceType: file.type.startsWith("image/") ? "image" : "raw",
  });

  const document = await leaveDocumentRepository.create({
    leaveRequestId,
    uploadedBy,
    documentType,
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
