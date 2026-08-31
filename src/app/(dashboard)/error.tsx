"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/design-system/sst";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger-light px-6 py-12 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger ring-1 ring-inset ring-danger/20">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </span>

      <h2 className="mt-4 text-h3 text-danger">This screen didn&apos;t load</h2>
      <p className="mt-2 max-w-md text-body text-muted">
        {error.message ||
          "The screen stopped before it finished rendering. Your leave requests and approvals are unaffected."}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload the page
        </Button>
      </div>

      {error.digest && (
        <p className="mt-6 font-mono text-micro uppercase tracking-wider text-muted">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
