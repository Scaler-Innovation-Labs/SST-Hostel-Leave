import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteByKey,
  extractKeyFromUrl,
  getS3KeyFromMetadata,
} from "@/lib/s3";
import { auditService } from "@/services/audit/audit.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export async function deleteLeaveDocument(
  documentId: string,
  currentUser: CurrentUser,
  leaveRequestId?: string,
): Promise<void> {
  const document = await leaveDocumentRepository.findById(documentId);

  if (!document) {
    throw new NotFoundError("LeaveDocument");
  }

  // Bind the document to the path leave: a mismatched {id} is a client
  // bug (or probe), never a cross-leave delete.
  if (leaveRequestId && document.leaveRequestId !== leaveRequestId) {
    throw new ValidationError("Document does not belong to this leave request");
  }

  // IDOR guard: students may only delete their own leave's documents; staff
  // must be within the leave's hostel scope.
  if (document.leaveRequestId) {
    const leave = await leaveRepository.findById(document.leaveRequestId);
    if (leave) {
      await assertCanAccessLeave(currentUser, leave);
    }
  }

  // Extract the S3 object key from metadata (preferred) or file URL (fallback)
  const objectKey =
    getS3KeyFromMetadata(document.metadata) ??
    extractKeyFromUrl(document.fileUrl);

  if (objectKey) {
    // A `false` (not-removed) result must surface: silently
    // marking DELETED while the file lives on is an orphan by design.
    const deleted = await deleteByKey(objectKey);
    if (!deleted) {
      throw new ValidationError("Document could not be removed from storage");
    }
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
