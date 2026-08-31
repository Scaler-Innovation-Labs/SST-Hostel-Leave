"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-4 text-display">!</div>
        <h1 className="mb-2 text-h2 font-semibold">Something went wrong</h1>
        <p className="mb-6 text-body text-muted">
          {error.message ?? "An unexpected error occurred."}
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
