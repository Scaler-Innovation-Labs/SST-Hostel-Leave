import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { ParentApprovalFlow } from "@/components/parent/ParentApprovalFlow";
import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";

function getErrorState(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("expired")) {
    return {
      icon: Clock,
      title: "Link Expired",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  if (lower.includes("already") || lower.includes("processed")) {
    return {
      icon: CheckCircle2,
      title: "Already Responded",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }

  return {
    icon: AlertTriangle,
    title: "Invalid Link",
    className: "bg-destructive/10 text-destructive",
  };
}

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
    errorMessage = error instanceof Error ? error.message : "Invalid or expired link";
  }

  if (errorMessage || !leaveData) {
    const { icon: Icon, title, className } = getErrorState(
      errorMessage ?? ""
    );

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div
            className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-full ${className}`}
          >
            <Icon className="size-9" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">
            {errorMessage ?? "Invalid or expired link"}
          </p>
          <p className="mt-6 text-sm text-muted-foreground/70">
            If you believe this is a mistake, please contact the school.
          </p>
        </div>
      </div>
    );
  }

  return <ParentApprovalFlow token={token} leaveData={leaveData} />;
}
