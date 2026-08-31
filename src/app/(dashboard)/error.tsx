"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-3 text-h1">!</div>
        <h2 className="mb-2 text-h3 font-semibold">Dashboard error</h2>
        <p className="mb-4 text-body text-muted">
          {error.message ?? "Something went wrong loading this page."}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-bg px-4 text-body font-medium hover:bg-surface-hover"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-body font-medium text-on-fill hover:bg-accent/90"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
