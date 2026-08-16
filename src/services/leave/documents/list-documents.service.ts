import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export type DocumentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  documentType: string;
  documentStatus: string;
  createdAt: Date;
};

export async function listLeaveDocuments(
  leaveRequestId: string,
  currentUser: CurrentUser,
): Promise<DocumentItem[]> {
  // IDOR guard: a STUDENT may only list their own leave's documents; staff
  // must be within the leave's hostel scope.
  const leave = await leaveRepository.findById(leaveRequestId);
  if (!leave) throw new NotFoundError("LeaveRequest");
  await assertCanAccessLeave(currentUser, leave);

  const documents = await leaveDocumentRepository.findByLeaveRequestId(
    leaveRequestId,
    undefined,
    ["ACTIVE", "REPLACED"],
  );

  return documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    documentType: doc.documentType,
    documentStatus: doc.documentStatus,
    createdAt: doc.createdAt,
  }));
}
