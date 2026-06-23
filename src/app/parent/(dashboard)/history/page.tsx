"use client";

import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type HistoryItem = {
  id: string;
  decision: string;
  studentName?: string;
  leaveReason?: string;
  startAt?: string;
  endAt?: string;
  actedAt?: string;
};

export default function ParentHistoryPage() {
  const { data, isLoading, error, mutate } = useSWR(
    "/api/v1/parent/history",
    fetcher
  );

  if (isLoading) return <LoadingState count={4} />;

  if (error) {
    return (
      <ErrorState
        message="Failed to load history"
        onRetry={() => mutate()}
      />
    );
  }

  const history: HistoryItem[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision History"
        description="Your past approvals and rejections."
      />

      {history.length === 0 ? (
        <p className="text-muted-foreground">No decisions recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="space-y-1">
                <p className="font-medium">{item.studentName ?? "—"}</p>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {item.leaveReason ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.startAt
                    ? new Date(item.startAt).toLocaleDateString()
                    : "—"}{" "}
                  –{" "}
                  {item.endAt
                    ? new Date(item.endAt).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.decision === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {item.decision}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.actedAt
                    ? new Date(item.actedAt).toLocaleDateString()
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
