import { CalendarX, CheckCircle2, ShieldAlert } from "lucide-react";

import { ParentApprovalFlow } from "@/components/parent/ParentApprovalFlow";
import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";

/**
 * Why the link didn't open — in a parent's terms, not the system's.
 *
 * Each case answers what happened, why, and what to do about it. A parent who
 * followed a link from a text message has no way to act on "Invalid token".
 */
function explainFailure(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("expired")) {
    return {
      Icon: CalendarX,
      tone: "warning" as const,
      title: "This link has expired",
      why: "Approval links are only valid for a limited time, so they can't be reused later by anyone else.",
      whatNow:
        "Ask your child to resubmit their leave request. You'll get a fresh link straight away.",
    };
  }

  if (lower.includes("already") || lower.includes("processed")) {
    return {
      Icon: CheckCircle2,
      tone: "success" as const,
      title: "You've already answered this one",
      why: "This request has your decision recorded, so the link has been used.",
      whatNow:
        "There's nothing more to do. Your child can see the outcome in their leave history.",
    };
  }

  return {
    Icon: ShieldAlert,
    tone: "danger" as const,
    title: "This link isn't valid",
    why: "It may have been copied incompletely, or it belongs to a request that has since been withdrawn.",
    whatNow:
      "Open the link directly from the message you received. If it still fails, contact the hostel office.",
  };
}

const TONE = {
  warning: "bg-warning-light text-warning ring-warning/20",
  success: "bg-success-light text-success ring-success/20",
  danger: "bg-danger-light text-danger ring-danger/20",
};

export default async function ParentApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let leaveData;
  let errorMessage: string | null = null;

  try {
    leaveData = await getLeaveDetailsByToken(token);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "This link isn't valid";
  }

  if (errorMessage || !leaveData) {
    const { Icon, tone, title, why, whatNow } = explainFailure(
      errorMessage ?? ""
    );

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-raised">
          <span
            className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-inset ${TONE[tone]}`}
          >
            <Icon className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="text-h2 text-ink">{title}</h1>
          <p className="mt-3 text-body text-muted">{why}</p>
          <p className="mt-3 text-body text-muted">{whatNow}</p>
        </div>
      </div>
    );
  }

  return <ParentApprovalFlow token={token} leaveData={leaveData} />;
}
