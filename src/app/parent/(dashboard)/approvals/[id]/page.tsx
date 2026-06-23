"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ROUTES } from "@/constants/routes";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ApprovalDetail = {
  id: string;
  studentName?: string;
  leaveReason?: string;
  startAt?: string;
  endAt?: string;
  submittedForm?: Record<string, unknown> | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function ParentApprovalDetailPage({ params }: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  params.then((p) => {
    if (!approvalId) setApprovalId(p.id);
  });

  const { data, isLoading, error: fetchError, mutate } = useSWR(
    approvalId ? `/api/v1/parent/approvals/${approvalId}` : null,
    fetcher
  );

  if (isLoading) return <LoadingState count={1} />;

  if (fetchError) {
    return (
      <ErrorState
        message="Failed to load approval"
        onRetry={() => mutate()}
      />
    );
  }

  const approval: ApprovalDetail | null = data?.data ?? null;

  if (!approval) {
    return <p className="text-muted-foreground">Approval not found.</p>;
  }

  async function handleSubmit() {
    if (!decision) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/parent/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error?.message ?? "Failed to submit decision");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-lg font-semibold">
            Decision submitted successfully!
          </p>
          <p className="mt-2 text-muted-foreground">
            You chose to{" "}
            <strong>{decision === "APPROVED" ? "approve" : "reject"}</strong>{" "}
            this leave request.
          </p>
          <button
            onClick={() => router.push(ROUTES.PARENT_APPROVALS)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Approvals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Leave Request</h2>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted-foreground">Student</span>
            <p className="font-medium">{approval.studentName ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Reason</span>
            <p>{approval.leaveReason ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Dates</span>
            <p>
              {approval.startAt
                ? new Date(approval.startAt).toLocaleDateString()
                : "—"}{" "}
              –{" "}
              {approval.endAt
                ? new Date(approval.endAt).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Your Decision</h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setDecision("APPROVED")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                decision === "APPROVED"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background hover:bg-muted"
              }`}
            >
              Approve
            </button>
            <button
              onClick={() => setDecision("REJECTED")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                decision === "REJECTED"
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "border border-border bg-background hover:bg-muted"
              }`}
            >
              Reject
            </button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setComments(e.target.value)
              }
              placeholder="Add a comment..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!decision || submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Decision"}
          </button>
        </div>
      </div>
    </div>
  );
}
