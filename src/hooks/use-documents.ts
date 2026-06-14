"use client";

import useSWR from "swr";

import { getDocumentsUrl } from "@/lib/api/leave-api";

export type DocumentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  documentType: string;
  documentStatus: string;
  createdAt: string;
};

export function useDocuments(leaveId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    leaveId ? getDocumentsUrl(leaveId) : null,
  );

  return {
    documents: (data?.data as DocumentItem[]) ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
