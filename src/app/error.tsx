"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/design-system/sst";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-raised"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger ring-1 ring-inset ring-danger/20">
          <AlertCircle className="h-7 w-7" aria-hidden />
        </span>

        {/* Names what broke rather than apologising for it. */}
        <h1 className="mt-5 text-h2 tracking-tight text-ink">
          This page didn&apos;t load
        </h1>
        <p className="mt-3 text-body text-muted">
          {error.message ||
            "The page stopped before it finished rendering. Nothing you submitted has been lost."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-micro uppercase tracking-wider text-muted">
            Reference {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
