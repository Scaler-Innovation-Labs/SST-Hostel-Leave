import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import {
  extractKeyFromUrl,
  getPresignedGetUrl,
  getS3KeyFromMetadata,
} from "@/lib/s3";
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

  // The bucket is private: mint a time-limited URL per document so the
  // stored canonical `fileUrl` never leaks a permanent address. A mint
  // failure falls back to the stored URL (e.g. legacy Cloudinary rows).
  return Promise.all(
    documents.map(async (doc) => {
      const objectKey =
        getS3KeyFromMetadata(doc.metadata) ?? extractKeyFromUrl(doc.fileUrl);
      let fileUrl = doc.fileUrl;
      if (objectKey) {
        try {
          fileUrl = await getPresignedGetUrl(objectKey);
        } catch {
          // Best-effort: surface the stored URL rather than failing the list.
        }
      }
      return {
        id: doc.id,
        fileName: doc.fileName,
        fileUrl,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        documentType: doc.documentType,
        documentStatus: doc.documentStatus,
        createdAt: doc.createdAt,
      };
    }),
  );
}
