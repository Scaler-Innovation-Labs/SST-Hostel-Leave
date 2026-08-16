"use client";

import { FileText, Image, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { type DocumentItem,useDocuments } from "@/hooks/use-documents";
import { deleteLeaveDocument } from "@/lib/api/leave-api";

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <FileText className="h-5 w-5" />;
  if (mimeType.startsWith("image/")) return <Image aria-label="Image document" className="h-5 w-5" />;
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
};

export function DocumentList({ leaveId, canDelete = false }: DocumentListProps) {
  const { documents, isLoading, isError, error, mutate } = useDocuments(leaveId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  if (isLoading) return <CollapsibleSection title="Documents" icon={FileText}><LoadingState count={2} /></CollapsibleSection>;
  if (isError) return <CollapsibleSection title="Documents" icon={FileText}><ErrorState message={error?.message ?? "Failed to load documents"} onRetry={() => mutate()} /></CollapsibleSection>;
  if (documents.length === 0) return null;

  return (
    <CollapsibleSection title="Documents" icon={FileText}>
      <div className="space-y-2">
        {documents.map((doc: DocumentItem) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {getFileIcon(doc.mimeType)}
            </div>

            <div className="min-w-0 flex-1">
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium hover:underline"
              >
                {doc.fileName}
              </a>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.fileSize)}
                {doc.mimeType && ` · ${doc.mimeType.split("/")[1]?.toUpperCase() ?? ""}`}
              </p>
            </div>

            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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
          onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
          title="Delete Document"
          description="Are you sure you want to delete this document? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          loading={deletingId !== null}
        />
      </div>
    </CollapsibleSection>
  );
}
