"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { uploadLeaveDocument } from "@/lib/api/leave-api";

type DocumentUploadProps = {
  leaveId: string;
  onUploadSuccess: () => void;
  disabled?: boolean;
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

export function DocumentUpload({ leaveId, onUploadSuccess, disabled }: DocumentUploadProps) {
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
      await uploadLeaveDocument(leaveId, file, "GENERAL");
      onUploadSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [leaveId, onUploadSuccess]);

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
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
        } ${disabled || uploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {uploading ? "Uploading..." : "Drop file here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
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
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
