import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { uploadFromBuffer } from "@/lib/cloudinary";
import { NotFoundError } from "@/lib/errors";

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
): Promise<UploadDocumentResult> {
  const leave = await leaveRepository.findById(leaveRequestId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
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
