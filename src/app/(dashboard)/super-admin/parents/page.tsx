"use client";

import useSWR from "swr";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ParentItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string;
  isPrimary: boolean;
  studentName: string | null;
  studentRollNumber: string | null;
};

type ParentListResponse = {
  items: ParentItem[];
  total: number;
  page: number;
  totalPages: number;
};

export default function SuperAdminParentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: ParentListResponse }>(
    `/api/v1/parents?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    fetcher
  );

  if (isLoading) return <LoadingState count={4} />;

  if (error) {
    return <ErrorState message="Failed to load parents" onRetry={() => mutate()} />;
  }

  const parents = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Management"
        description="View and manage parent records linked to students."
      />

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search parents..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Relation</th>
              <th className="px-4 py-3 text-left font-medium">Student</th>
              <th className="px-4 py-3 text-left font-medium">Primary</th>
            </tr>
          </thead>
          <tbody>
            {parents?.items.map((parent) => (
              <tr key={parent.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{parent.name}</td>
                <td className="px-4 py-3">{parent.phone}</td>
                <td className="px-4 py-3">{parent.email ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{parent.relationship}</td>
                <td className="px-4 py-3">
                  {parent.studentName ? (
                    <span>
                      {parent.studentName} ({parent.studentRollNumber ?? "—"})
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {parent.isPrimary ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Primary
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {parents && parents.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {parents.page} of {parents.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(parents.totalPages, p + 1))}
            disabled={page >= parents.totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
