"use client";

import Link from "next/link";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ApprovalItem = {
  id: string;
  studentName?: string;
  leaveReason?: string;
  startAt?: string;
  endAt?: string;
};

export default function ParentApprovalsPage() {
  const { data, isLoading, error, mutate } = useSWR(
    "/api/v1/parent/approvals",
    fetcher,
    { refreshInterval: 30_000 }
  );

  if (isLoading) return <LoadingState count={4} />;

  if (error) {
    return (
      <ErrorState
        message="Failed to load approvals"
        onRetry={() => mutate()}
      />
    );
  }

  const approvals: ApprovalItem[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Approvals"
        description="Review and respond to leave requests from your ward."
      />

      {approvals.length === 0 ? (
        <p className="text-muted-foreground">
          No pending approvals at this time.
        </p>
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => (
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
              <Link href={`/parent/approvals/${item.id}`}>
                <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  Review
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
