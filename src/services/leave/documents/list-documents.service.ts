import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";

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
): Promise<DocumentItem[]> {
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
