import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import { deleteByPublicId, extractPublicIdFromUrl } from "@/lib/cloudinary";
import { NotFoundError } from "@/lib/errors";

export async function deleteLeaveDocument(
  documentId: string,
): Promise<void> {
  const document = await leaveDocumentRepository.findById(documentId);

  if (!document) {
    throw new NotFoundError("LeaveDocument");
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
