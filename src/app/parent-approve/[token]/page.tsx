import { AlertTriangle } from "lucide-react";

import { ParentApprovalFlow } from "@/components/parent/ParentApprovalFlow";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limiter";
import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";

export default async function ParentApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let leaveData;
  let failed = false;

  try {
    // Same bound as the decision endpoint: unauthenticated token probing
    // must be rate-limited. The limiter key is the token HASH — the raw
    // token is a bearer credential and must not be persisted in
    // rate_limit_entries.
    await rateLimit(`parent-approve-view:${await sha256(token)}`, 30, 900_000);
    leaveData = await getLeaveDetailsByToken(token);
  } catch {
    // Deliberately generic: invalid / expired / already-responded / limited
    // all render the same state so the page is not a validity oracle. The
    // service logs the real reason server-side.
    failed = true;
  }

  if (failed || !leaveData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <AlertTriangle className="size-9" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Unable to process this approval link</h1>
          <p className="mt-2 text-muted-foreground">
            This link is invalid, expired, or has already been used.
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
