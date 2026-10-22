"use client";

import { FileText, Image, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/features/leaves/components/DocumentUpload";
import { type DocumentItem, useDocuments } from "@/hooks/use-documents";
import { deleteLeaveDocument, getQuestionsUrl } from "@/lib/api/leave-api";

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <FileText className="h-5 w-5" />;
  if (mimeType.startsWith("image/"))
    return <Image aria-label="Image document" className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DocumentListProps = {
  leaveId: string;
  canDelete?: boolean;
  canUpload?: boolean;
  requiredDocuments?: Array<{
    type: string;
    label: string;
  }>;
  /** Whether staff/admin has requested documents or asked a question on this leave */
  hasAdminAsked?: boolean;
};

export function DocumentList({
  leaveId,
  canDelete = false,
  canUpload = false,
  requiredDocuments = [],
  hasAdminAsked: hasAdminAskedProp,
}: DocumentListProps) {
  const { documents, isLoading, isError, error, mutate } =
    useDocuments(leaveId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: questionData } = useSWR<{
    data: { items: Array<{ id: string; askedByRole: string }>; total: number };
  }>(
    hasAdminAskedProp !== undefined
      ? null
      : leaveId
        ? getQuestionsUrl(leaveId, { limit: 50 })
        : null,
  );

  const hasAdminAsked =
    hasAdminAskedProp ??
    Boolean(
      questionData?.data?.items && questionData.data.items.length > 0,
    );

  const missingRequiredDocuments = requiredDocuments.filter(
    (requiredDocument) =>
      !documents.some(
        (document) => document.documentType === requiredDocument.type,
      ),
  );

  const canUploadSupporting = canUpload && hasAdminAsked;

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await deleteLeaveDocument(leaveId, confirmDeleteId);
      toast.success("Document deleted");
      await mutate();
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (isLoading)
    return (
      <CollapsibleSection title="Documents" icon={FileText}>
        <LoadingState count={2} />
      </CollapsibleSection>
    );
  if (isError)
    return (
      <CollapsibleSection title="Documents" icon={FileText}>
        <ErrorState
          message={error?.message ?? "Failed to load documents"}
          onRetry={() => mutate()}
        />
      </CollapsibleSection>
    );
  return (
    <CollapsibleSection title="Documents" icon={FileText}>
      <div className="space-y-2">
        {missingRequiredDocuments.map((requiredDocument) => (
          <div
            key={requiredDocument.type}
            className="rounded-xl border border-warning/30 bg-warning-light p-4"
          >
            <p className="text-body font-medium">
              {requiredDocument.label} required
            </p>
            <p className="mt-1 text-caption text-muted">
              Upload this document so it can be reviewed with your leave
              request.
            </p>
            {canUpload && (
              <div className="mt-4">
                <DocumentUpload
                  leaveId={leaveId}
                  documentType={requiredDocument.type}
                  documentLabel={requiredDocument.label}
                  onUploadSuccess={() => mutate()}
                />
              </div>
            )}
          </div>
        ))}

        {canUploadSupporting && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-body font-medium">Supporting document</p>
            <p className="mt-1 text-caption text-muted">
              Add any other document that will help reviewers assess this
              request.
            </p>
            <div className="mt-4">
              <DocumentUpload
                leaveId={leaveId}
                documentLabel="supporting document"
                onUploadSuccess={() => mutate()}
              />
            </div>
          </div>
        )}

        {documents.length === 0 &&
          missingRequiredDocuments.length === 0 &&
          !canUploadSupporting && (
            <p className="py-2 text-center text-body text-muted">
              No documents attached.
            </p>
          )}

        {documents.map((doc: DocumentItem) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-sunken/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              {getFileIcon(doc.mimeType)}
            </div>

            <div className="min-w-0 flex-1">
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-body font-medium hover:underline"
              >
                {doc.fileName}
              </a>
              <p className="text-caption text-muted">
                {formatFileSize(doc.fileSize)}
                {doc.mimeType &&
                  ` · ${doc.mimeType.split("/")[1]?.toUpperCase() ?? ""}`}
              </p>
            </div>

            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted hover:text-danger"
                onClick={() => setConfirmDeleteId(doc.id)}
                disabled={deletingId === doc.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        <ConfirmationDialog
          open={!!confirmDeleteId}
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteId(null);
          }}
          title="Delete this document?"
          consequence="The file is removed permanently and cannot be recovered. If it was required for this leave type, you'll need to upload a replacement."
          confirmLabel="Delete document"
          dismissLabel="Keep it"
          onConfirm={handleDelete}
          loading={deletingId !== null}
        />
      </div>
    </CollapsibleSection>
  );
}
