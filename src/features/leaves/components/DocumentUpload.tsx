"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { uploadLeaveDocument } from "@/lib/api/leave-api";

type DocumentUploadProps = {
  leaveId: string;
  onUploadSuccess: () => void;
  disabled?: boolean;
  documentType?: string;
  documentLabel?: string;
};

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUpload({
  leaveId,
  onUploadSuccess,
  disabled,
  documentType = "GENERAL",
  documentLabel = "file",
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("File type not supported. Allowed: JPG, PNG, GIF, PDF, DOC, DOCX");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      await uploadLeaveDocument(leaveId, file, documentType);
      toast.success(`${documentLabel} uploaded`);
      onUploadSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [documentLabel, documentType, leaveId, onUploadSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? "border-accent bg-accent/5"
            : "border-border bg-surface-sunken/30 hover:border-muted/40 hover:bg-surface-sunken/50"
        } ${disabled || uploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <Upload className="mb-3 h-8 w-8 text-muted" />
        <p className="text-body font-medium">
          {uploading ? "Uploading..." : `Drop ${documentLabel.toLowerCase()} here or click to upload`}
        </p>
        <p className="mt-1 text-caption text-muted">
          JPG, PNG, GIF, PDF, DOC, DOCX up to 10MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
      </div>

      {uploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-body text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
