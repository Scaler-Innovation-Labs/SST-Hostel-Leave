import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { deleteByPublicId, extractPublicIdFromUrl } from "@/lib/cloudinary";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export async function deleteLeaveDocument(
  documentId: string,
  currentUser: CurrentUser,
): Promise<void> {
  const document = await leaveDocumentRepository.findById(documentId);

  if (!document) {
    throw new NotFoundError("LeaveDocument");
  }

  // IDOR guard: students may only delete their own leave's documents; staff
  // must be within the leave's hostel scope.
  if (document.leaveRequestId) {
    const leave = await leaveRepository.findById(document.leaveRequestId);
    if (leave) {
      await assertCanAccessLeave(currentUser, leave);
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

  if (currentUser) {
    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      document.leaveRequestId ?? document.id,
      currentUser.id,
      { documentId: document.id, fileName: document.fileName },
    );
  }
}
