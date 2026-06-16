import type { CurrentUser } from "@/lib/auth/types";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { deleteByPublicId, extractPublicIdFromUrl } from "@/lib/cloudinary";
import { NotFoundError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function deleteLeaveDocument(
  documentId: string,
  currentUser?: CurrentUser,
): Promise<void> {
  const document = await leaveDocumentRepository.findById(documentId);

  if (!document) {
    throw new NotFoundError("LeaveDocument");
  }

  if (currentUser && document.leaveRequestId) {
    const leave = await leaveRepository.findById(document.leaveRequestId);
    if (leave) {
      await verifyStudentOwnership(currentUser, leave.studentId);
    }
  }

  // Extract public_id from metadata (preferred) or Cloudinary URL (fallback)
  const publicId =
    (document.metadata as { cloudinaryPublicId?: string } | null)?.cloudinaryPublicId ??
    extractPublicIdFromUrl(document.fileUrl);

  if (publicId) {
    // Default to "raw" for documents (PDFs, DOCX) rather than "image"
    const resourceType = document.mimeType?.startsWith("image/") ? "image" : "raw";
    await deleteByPublicId(publicId, resourceType);
  }

  // Soft delete in DB
  await leaveDocumentRepository.updateStatus(documentId, "DELETED");
}
